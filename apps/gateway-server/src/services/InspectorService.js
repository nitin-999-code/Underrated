/**
 * Inspector Service
 * 
 * Captures and stores request/response data for the dashboard
 * with real-time event emission for WebSocket updates.
 */

const { EventEmitter } = require('events');
const {
    createLogger,
    TUNNEL_CONFIG,
    sanitizeHeaders,
    getContentType,
    isJsonContentType,
} = require('@devtunnel/shared');

/**
 * Represents a captured request/response pair
 */
class InspectedTraffic {
    constructor(request) {
        this.requestId = request.requestId;
        this.tunnelId = request.tunnelId;
        this.subdomain = request.subdomain;

        // Request data
        this.request = {
            method: request.method,
            path: request.path,
            headers: request.headers,
            body: request.body,
            query: request.query,
            timestamp: request.timestamp,
            clientIp: request.clientIp,
        };

        // Response data (filled in later)
        this.response = null;

        // Timing
        this.responseTime = null;
        this.createdAt = Date.now();
    }

    /**
     * Attaches response data
     * @param {Object} response - Response data
     */
    setResponse(response) {
        this.response = {
            statusCode: response.statusCode,
            headers: response.headers,
            body: response.body,
            error: response.error,
            timestamp: response.timestamp,
        };
        this.responseTime = response.responseTime;
    }

    /**
     * Formats the traffic for JSON output
     * @param {boolean} sanitize - Whether to sanitize sensitive headers
     * @returns {Object} Formatted traffic data
     */
    toJSON(sanitize = false) {
        const result = {
            requestId: this.requestId,
            tunnelId: this.tunnelId,
            subdomain: this.subdomain,
            request: {
                ...this.request,
                headers: sanitize ? sanitizeHeaders(this.request.headers) : this.request.headers,
            },
            response: this.response ? {
                ...this.response,
                headers: sanitize ? sanitizeHeaders(this.response.headers || {}) : this.response.headers,
            } : null,
            responseTime: this.responseTime,
            createdAt: this.createdAt,
        };

        // Try to parse JSON bodies for better display
        if (result.request.body && isJsonContentType(getContentType(result.request.headers))) {
            try {
                result.request.parsedBody = JSON.parse(result.request.body);
            } catch { }
        }

        if (result.response?.body && isJsonContentType(getContentType(result.response.headers || {}))) {
            try {
                // Body might be base64 encoded
                const decoded = Buffer.from(result.response.body, 'base64').toString('utf8');
                result.response.parsedBody = JSON.parse(decoded);
            } catch { }
        }

        return result;
    }

    /**
     * Generates a curl command for this request
     * @returns {string} Curl command
     */
    toCurl() {
        const parts = ['curl'];

        // Method
        if (this.request.method !== 'GET') {
            parts.push(`-X ${this.request.method}`);
        }

        // Headers
        for (const [key, value] of Object.entries(this.request.headers)) {
            if (!['host', 'content-length'].includes(key.toLowerCase())) {
                parts.push(`-H '${key}: ${value}'`);
            }
        }

        // Body
        if (this.request.body) {
            parts.push(`-d '${this.request.body.replace(/'/g, "'\\''")}'`);
        }

        // URL - construct from subdomain and path
        const url = `https://${this.subdomain}.example.com${this.request.path}`;
        parts.push(`'${url}'`);

        return parts.join(' \\\n  ');
    }
}

/**
 * Service for capturing and storing traffic data
 */
class InspectorService extends EventEmitter {
    constructor(options = {}) {
        super();
        this.logger = createLogger({ name: 'InspectorService' });

        // Configuration
        this.maxStoredRequests = options.maxStoredRequests || TUNNEL_CONFIG.MAX_STORED_REQUESTS;
        this.retentionMinutes = options.retentionMinutes || TUNNEL_CONFIG.TRAFFIC_HISTORY_MINUTES;

        // Storage by tunnel ID
        this.trafficByTunnel = new Map();

        // All traffic (limited circular buffer)
        this.allTraffic = [];

        // Map of requestId -> InspectedTraffic for fast lookup
        this.trafficByRequestId = new Map();

        // Start cleanup timer
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Records an incoming request
     * @param {Object} request - Request data
     * @returns {InspectedTraffic} Inspected traffic object
     */
    recordRequest(request) {
        const traffic = new InspectedTraffic(request);

        // Store in maps
        this.trafficByRequestId.set(request.requestId, traffic);

        // Store by tunnel
        if (!this.trafficByTunnel.has(request.tunnelId)) {
            this.trafficByTunnel.set(request.tunnelId, []);
        }
        this.trafficByTunnel.get(request.tunnelId).push(traffic);

        // Store in global list
        this.allTraffic.push(traffic);

        // Enforce limits
        this.enforceLimit();

        // Emit event for real-time updates
        this.emit('request', traffic.toJSON());

        this.logger.debug(`Request recorded: ${request.requestId}`, {
            method: request.method,
            path: request.path,
        });

        return traffic;
    }

    /**
     * Records a response for a request
     * @param {Object} response - Response data
     */
    recordResponse(response) {
        const traffic = this.trafficByRequestId.get(response.requestId);

        if (!traffic) {
            this.logger.warn(`No request found for response: ${response.requestId}`);
            return;
        }

        traffic.setResponse(response);

        // Emit event for real-time updates
        this.emit('response', traffic.toJSON());

        this.logger.debug(`Response recorded: ${response.requestId}`, {
            statusCode: response.statusCode,
            responseTime: response.responseTime,
        });
    }

    /**
     * Gets traffic for a specific tunnel
     * @param {string} tunnelId - Tunnel ID
     * @param {Object} options - Query options
     * @returns {Object[]} Array of traffic data
     */
    getTrafficByTunnel(tunnelId, options = {}) {
        const traffic = this.trafficByTunnel.get(tunnelId) || [];
        return this.filterAndPaginate(traffic, options);
    }

    /**
     * Gets all traffic
     * @param {Object} options - Query options
     * @returns {Object[]} Array of traffic data
     */
    getAllTraffic(options = {}) {
        return this.filterAndPaginate(this.allTraffic, options);
    }

    /**
     * Gets a specific request by ID
     * @param {string} requestId - Request ID
     * @returns {Object|null} Traffic data or null
     */
    getTrafficById(requestId) {
        const traffic = this.trafficByRequestId.get(requestId);
        return traffic ? traffic.toJSON() : null;
    }

    /**
     * Gets the curl command for a request
     * @param {string} requestId - Request ID
     * @returns {string|null} Curl command or null
     */
    getCurlCommand(requestId) {
        const traffic = this.trafficByRequestId.get(requestId);
        return traffic ? traffic.toCurl() : null;
    }

    /**
     * Filters and paginates traffic data
     * @param {InspectedTraffic[]} traffic - Traffic array
     * @param {Object} options - Filter options
     * @returns {Object[]} Filtered traffic data
     */
    filterAndPaginate(traffic, options = {}) {
        let result = [...traffic];

        // Filter by method
        if (options.method) {
            result = result.filter(t => t.request.method === options.method.toUpperCase());
        }

        // Filter by status code
        if (options.statusCode) {
            result = result.filter(t => t.response?.statusCode === parseInt(options.statusCode, 10));
        }

        // Filter by path pattern
        if (options.path) {
            const pattern = new RegExp(options.path, 'i');
            result = result.filter(t => pattern.test(t.request.path));
        }

        // Filter by time range
        if (options.since) {
            const since = new Date(options.since).getTime();
            result = result.filter(t => t.createdAt >= since);
        }

        // Sort (newest first by default)
        result.sort((a, b) => b.createdAt - a.createdAt);

        // Pagination
        const limit = options.limit || 50;
        const offset = options.offset || 0;
        result = result.slice(offset, offset + limit);

        return result.map(t => t.toJSON(options.sanitize));
    }

    /**
     * Enforces storage limits
     */
    enforceLimit() {
        // Global limit
        while (this.allTraffic.length > this.maxStoredRequests) {
            const removed = this.allTraffic.shift();
            this.trafficByRequestId.delete(removed.requestId);
        }

        // Per-tunnel limit
        for (const [tunnelId, traffic] of this.trafficByTunnel) {
            while (traffic.length > this.maxStoredRequests / 2) {
                traffic.shift();
            }
        }
    }

    /**
     * Cleans up old traffic data
     */
    cleanup() {
        const cutoff = Date.now() - (this.retentionMinutes * 60 * 1000);

        // Clean global list
        this.allTraffic = this.allTraffic.filter(t => t.createdAt >= cutoff);

        // Clean by-tunnel storage
        for (const [tunnelId, traffic] of this.trafficByTunnel) {
            this.trafficByTunnel.set(
                tunnelId,
                traffic.filter(t => t.createdAt >= cutoff)
            );
        }

        // Clean lookup map
        for (const [requestId, traffic] of this.trafficByRequestId) {
            if (traffic.createdAt < cutoff) {
                this.trafficByRequestId.delete(requestId);
            }
        }

        this.logger.debug('Traffic cleanup completed', {
            remaining: this.allTraffic.length,
        });
    }

    /**
     * Clears all traffic data
     */
    clear() {
        this.allTraffic = [];
        this.trafficByTunnel.clear();
        this.trafficByRequestId.clear();
    }

    /**
     * Stops the cleanup timer
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }

    /**
     * Gets statistics about stored traffic
     * @returns {Object} Statistics
     */
    getStats() {
        const totalTraffic = this.allTraffic.length;
        const tunnelCount = this.trafficByTunnel.size;

        let successCount = 0;
        let errorCount = 0;
        let totalResponseTime = 0;
        let responseTimeCount = 0;

        for (const traffic of this.allTraffic) {
            if (traffic.response) {
                if (traffic.response.statusCode >= 200 && traffic.response.statusCode < 400) {
                    successCount++;
                } else {
                    errorCount++;
                }
                if (traffic.responseTime) {
                    totalResponseTime += traffic.responseTime;
                    responseTimeCount++;
                }
            }
        }

        return {
            totalRequests: totalTraffic,
            activeTunnels: tunnelCount,
            successRate: totalTraffic > 0 ? (successCount / totalTraffic * 100).toFixed(2) : 0,
            errorRate: totalTraffic > 0 ? (errorCount / totalTraffic * 100).toFixed(2) : 0,
            avgResponseTime: responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : 0,
        };
    }
}

module.exports = InspectorService;
