/**
 * Tunnel Manager Service
 * 
 * Manages active tunnel connections, subdomain allocation,
 * and tunnel lifecycle.
 */

const { EventEmitter } = require('events');
const {
    createLogger,
    generateTunnelId,
    generateSubdomain,
    isValidSubdomain,
    TUNNEL_CONFIG,
    ERROR_CODES,
} = require('@devtunnel/shared');

/**
 * Represents a single tunnel connection
 */
class Tunnel {
    constructor({ tunnelId, subdomain, ws, localPort, clientInfo }) {
        this.tunnelId = tunnelId;
        this.subdomain = subdomain;
        this.ws = ws;
        this.localPort = localPort;
        this.clientInfo = clientInfo;
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
        this.requestCount = 0;
        this.bytesIn = 0;
        this.bytesOut = 0;
        this.isAlive = true;

        // Pending requests waiting for responses
        this.pendingRequests = new Map();
    }

    /**
     * Updates the last activity timestamp
     */
    touch() {
        this.lastActivity = Date.now();
    }

    /**
     * Increments request statistics
     * @param {number} bytesIn - Incoming bytes
     * @param {number} bytesOut - Outgoing bytes
     */
    recordRequest(bytesIn = 0, bytesOut = 0) {
        this.requestCount++;
        this.bytesIn += bytesIn;
        this.bytesOut += bytesOut;
        this.touch();
    }

    /**
     * Adds a pending request
     * @param {string} requestId - Request ID
     * @param {Object} requestData - Request data with resolve/reject callbacks
     */
    addPendingRequest(requestId, requestData) {
        this.pendingRequests.set(requestId, {
            ...requestData,
            startTime: Date.now(),
        });
    }

    /**
     * Resolves a pending request
     * @param {string} requestId - Request ID
     * @returns {Object|null} Pending request data or null
     */
    getPendingRequest(requestId) {
        return this.pendingRequests.get(requestId);
    }

    /**
     * Removes a pending request
     * @param {string} requestId - Request ID
     */
    removePendingRequest(requestId) {
        this.pendingRequests.delete(requestId);
    }

    /**
     * Gets tunnel statistics
     * @returns {Object} Tunnel stats
     */
    getStats() {
        return {
            tunnelId: this.tunnelId,
            subdomain: this.subdomain,
            localPort: this.localPort,
            createdAt: this.createdAt,
            lastActivity: this.lastActivity,
            requestCount: this.requestCount,
            bytesIn: this.bytesIn,
            bytesOut: this.bytesOut,
            pendingRequests: this.pendingRequests.size,
            uptime: Date.now() - this.createdAt,
        };
    }
}

/**
 * Manages all active tunnels
 */
class TunnelManager extends EventEmitter {
    constructor() {
        super();
        this.logger = createLogger({ name: 'TunnelManager' });

        // Map of subdomain -> Tunnel
        this.tunnelsBySubdomain = new Map();

        // Map of tunnelId -> Tunnel
        this.tunnelsById = new Map();

        // Map of WebSocket -> Tunnel[]
        this.tunnelsByWs = new Map();

        // Set of reserved subdomains
        this.reservedSubdomains = new Set(['api', 'www', 'admin', 'dashboard', 'app', 'mail', 'ftp']);
    }

    /**
     * Registers a new tunnel
     * @param {Object} options - Tunnel options
     * @param {WebSocket} options.ws - WebSocket connection
     * @param {string} options.requestedSubdomain - Requested subdomain (optional)
     * @param {number} options.localPort - Local port being tunneled
     * @param {Object} options.clientInfo - Client information
     * @returns {Object} Result with tunnel or error
     */
    registerTunnel({ ws, requestedSubdomain, localPort, clientInfo = {} }) {
        try {
            // Validate or generate subdomain
            let subdomain;

            if (requestedSubdomain) {
                // Validate requested subdomain
                if (!isValidSubdomain(requestedSubdomain)) {
                    return {
                        success: false,
                        error: 'Invalid subdomain format',
                        code: ERROR_CODES.INVALID_SUBDOMAIN,
                    };
                }

                if (this.reservedSubdomains.has(requestedSubdomain.toLowerCase())) {
                    return {
                        success: false,
                        error: 'Subdomain is reserved',
                        code: ERROR_CODES.SUBDOMAIN_TAKEN,
                    };
                }

                if (this.tunnelsBySubdomain.has(requestedSubdomain.toLowerCase())) {
                    return {
                        success: false,
                        error: 'Subdomain is already in use',
                        code: ERROR_CODES.SUBDOMAIN_TAKEN,
                    };
                }

                subdomain = requestedSubdomain.toLowerCase();
            } else {
                // Generate unique subdomain
                do {
                    subdomain = generateSubdomain();
                } while (this.tunnelsBySubdomain.has(subdomain) || this.reservedSubdomains.has(subdomain));
            }

            // Check per-client tunnel limit
            const existingTunnels = this.tunnelsByWs.get(ws) || [];
            if (existingTunnels.length >= TUNNEL_CONFIG.MAX_TUNNELS_PER_CLIENT) {
                return {
                    success: false,
                    error: 'Maximum tunnels per client exceeded',
                    code: ERROR_CODES.TUNNEL_LIMIT_EXCEEDED,
                };
            }

            // Create tunnel
            const tunnelId = generateTunnelId();
            const tunnel = new Tunnel({
                tunnelId,
                subdomain,
                ws,
                localPort,
                clientInfo,
            });

            // Register in all maps
            this.tunnelsBySubdomain.set(subdomain, tunnel);
            this.tunnelsById.set(tunnelId, tunnel);

            if (!this.tunnelsByWs.has(ws)) {
                this.tunnelsByWs.set(ws, []);
            }
            this.tunnelsByWs.get(ws).push(tunnel);

            this.logger.info(`Tunnel registered: ${subdomain} -> localhost:${localPort}`, {
                tunnelId,
                subdomain,
            });

            // Emit event for monitoring
            this.emit('tunnel:created', tunnel);

            return {
                success: true,
                tunnel,
            };
        } catch (error) {
            this.logger.error('Failed to register tunnel', { error: error.message });
            return {
                success: false,
                error: error.message,
                code: ERROR_CODES.CONNECTION_FAILED,
            };
        }
    }

    /**
     * Gets a tunnel by subdomain
     * @param {string} subdomain - Subdomain to look up
     * @returns {Tunnel|null} Tunnel or null
     */
    getTunnelBySubdomain(subdomain) {
        return this.tunnelsBySubdomain.get(subdomain?.toLowerCase()) || null;
    }

    /**
     * Gets a tunnel by ID
     * @param {string} tunnelId - Tunnel ID
     * @returns {Tunnel|null} Tunnel or null
     */
    getTunnelById(tunnelId) {
        return this.tunnelsById.get(tunnelId) || null;
    }

    /**
     * Gets all tunnels for a WebSocket connection
     * @param {WebSocket} ws - WebSocket connection
     * @returns {Tunnel[]} Array of tunnels
     */
    getTunnelsByWs(ws) {
        return this.tunnelsByWs.get(ws) || [];
    }

    /**
     * Closes a specific tunnel
     * @param {string} tunnelId - Tunnel ID to close
     * @param {string} reason - Reason for closing
     */
    closeTunnel(tunnelId, reason = 'Tunnel closed') {
        const tunnel = this.tunnelsById.get(tunnelId);
        if (!tunnel) return;

        this.logger.info(`Closing tunnel: ${tunnel.subdomain}`, { tunnelId, reason });

        // Clean up pending requests
        for (const [requestId, pending] of tunnel.pendingRequests) {
            if (pending.reject) {
                pending.reject(new Error('Tunnel closed'));
            }
        }
        tunnel.pendingRequests.clear();

        // Remove from maps
        this.tunnelsBySubdomain.delete(tunnel.subdomain);
        this.tunnelsById.delete(tunnelId);

        // Remove from ws map
        const wsTunnels = this.tunnelsByWs.get(tunnel.ws);
        if (wsTunnels) {
            const index = wsTunnels.indexOf(tunnel);
            if (index !== -1) {
                wsTunnels.splice(index, 1);
            }
            if (wsTunnels.length === 0) {
                this.tunnelsByWs.delete(tunnel.ws);
            }
        }

        // Emit event
        this.emit('tunnel:closed', tunnel, reason);
    }

    /**
     * Closes all tunnels for a WebSocket connection
     * @param {WebSocket} ws - WebSocket connection
     * @param {string} reason - Reason for closing
     */
    closeTunnelsForWs(ws, reason = 'Connection closed') {
        const tunnels = this.tunnelsByWs.get(ws) || [];
        for (const tunnel of [...tunnels]) {
            this.closeTunnel(tunnel.tunnelId, reason);
        }
    }

    /**
     * Closes all tunnels
     */
    closeAll() {
        for (const tunnelId of [...this.tunnelsById.keys()]) {
            this.closeTunnel(tunnelId, 'Server shutdown');
        }
    }

    /**
     * Gets the total number of active tunnels
     * @returns {number} Tunnel count
     */
    getTunnelCount() {
        return this.tunnelsById.size;
    }

    /**
     * Gets all tunnels as an array
     * @returns {Tunnel[]} Array of tunnels
     */
    getAllTunnels() {
        return Array.from(this.tunnelsById.values());
    }

    /**
     * Gets statistics for all tunnels
     * @returns {Object[]} Array of tunnel stats
     */
    getAllStats() {
        return this.getAllTunnels().map(t => t.getStats());
    }
}

module.exports = TunnelManager;
