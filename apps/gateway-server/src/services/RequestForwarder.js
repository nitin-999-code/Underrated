/**
 * Request Forwarder Service
 * 
 * Handles forwarding HTTP requests through WebSocket tunnels
 * to client CLI tools and streaming responses back.
 */

const {
    createLogger,
    generateRequestId,
    createHttpRequestMessage,
    MessageType,
    serializeMessage,
    TUNNEL_CONFIG,
    ERROR_CODES,
    createDeferred,
} = require('@devtunnel/shared');

class RequestForwarder {
    constructor(tunnelManager, inspectorService) {
        this.tunnelManager = tunnelManager;
        this.inspectorService = inspectorService;
        this.logger = createLogger({ name: 'RequestForwarder' });
    }

    /**
     * Forwards an HTTP request through a tunnel
     * @param {Object} options - Request options
     * @param {string} options.subdomain - Tunnel subdomain
     * @param {Object} options.req - Express request object
     * @param {Object} options.res - Express response object
     * @returns {Promise<void>}
     */
    async forwardRequest({ subdomain, req, res }) {
        const requestId = generateRequestId();
        const startTime = Date.now();

        // Find the tunnel
        const tunnel = this.tunnelManager.getTunnelBySubdomain(subdomain);

        if (!tunnel) {
            this.logger.debug(`Tunnel not found: ${subdomain}`);
            return res.status(404).json({
                error: 'Tunnel not found',
                code: ERROR_CODES.TUNNEL_NOT_FOUND,
                subdomain,
            });
        }

        // Check if WebSocket is still connected
        if (tunnel.ws.readyState !== 1) { // WebSocket.OPEN
            this.logger.warn(`Tunnel WebSocket not ready: ${subdomain}`);
            return res.status(502).json({
                error: 'Tunnel connection unavailable',
                code: ERROR_CODES.CONNECTION_CLOSED,
            });
        }

        try {
            // Prepare request data
            const body = req.body && req.body.length > 0 ? req.body : null;

            // Create request message
            const requestMessage = createHttpRequestMessage({
                requestId,
                method: req.method,
                path: req.originalUrl,
                headers: { ...req.headers },
                body: body ? body.toString('base64') : null,
                query: req.query,
            });

            // Record request for inspection
            const inspectData = {
                requestId,
                tunnelId: tunnel.tunnelId,
                subdomain,
                method: req.method,
                path: req.originalUrl,
                headers: { ...req.headers },
                body: body ? body.toString('utf8') : null,
                query: req.query,
                timestamp: Date.now(),
                clientIp: req.ip || req.connection?.remoteAddress,
            };
            this.inspectorService.recordRequest(inspectData);

            // Create deferred promise for response
            const { promise, resolve, reject } = createDeferred();

            // Set timeout
            const timeout = setTimeout(() => {
                tunnel.removePendingRequest(requestId);
                reject(new Error('Request timeout'));
            }, TUNNEL_CONFIG.REQUEST_TIMEOUT);

            // Store pending request
            tunnel.addPendingRequest(requestId, {
                resolve: (response) => {
                    clearTimeout(timeout);
                    resolve(response);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                },
                req,
                res,
                inspectData,
            });

            // Send request through WebSocket
            tunnel.ws.send(serializeMessage(requestMessage));
            this.logger.debug(`Request forwarded: ${requestId}`, {
                method: req.method,
                path: req.originalUrl,
                subdomain,
            });

            // Wait for response
            const response = await promise;

            // Calculate response time
            const responseTime = Date.now() - startTime;

            // Record response for inspection
            this.inspectorService.recordResponse({
                requestId,
                tunnelId: tunnel.tunnelId,
                statusCode: response.statusCode,
                headers: response.headers,
                body: response.body,
                responseTime,
                timestamp: Date.now(),
            });

            // Update tunnel stats
            const bodySize = body ? body.length : 0;
            const responseSize = response.body ? Buffer.from(response.body, 'base64').length : 0;
            tunnel.recordRequest(bodySize, responseSize);

            // Send response to client
            res.status(response.statusCode);

            // Set response headers (filter out hop-by-hop headers)
            const hopByHopHeaders = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade'];
            for (const [key, value] of Object.entries(response.headers || {})) {
                if (!hopByHopHeaders.includes(key.toLowerCase())) {
                    res.set(key, value);
                }
            }

            // Send response body
            if (response.body) {
                const responseBody = Buffer.from(response.body, 'base64');
                res.send(responseBody);
            } else {
                res.end();
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;

            this.logger.error(`Request forwarding failed: ${requestId}`, {
                error: error.message,
                subdomain,
            });

            // Record error for inspection
            this.inspectorService.recordResponse({
                requestId,
                tunnelId: tunnel?.tunnelId,
                statusCode: 502,
                error: error.message,
                responseTime,
                timestamp: Date.now(),
            });

            // Clean up pending request
            tunnel?.removePendingRequest(requestId);

            // Send error response
            if (!res.headersSent) {
                if (error.message === 'Request timeout') {
                    res.status(504).json({
                        error: 'Gateway timeout',
                        code: ERROR_CODES.REQUEST_TIMEOUT,
                    });
                } else {
                    res.status(502).json({
                        error: 'Bad gateway',
                        code: ERROR_CODES.REQUEST_FAILED,
                        message: error.message,
                    });
                }
            }
        }
    }

    /**
     * Handles a response received from a tunnel client
     * @param {Object} tunnel - Tunnel object
     * @param {Object} payload - Response payload
     */
    handleResponse(tunnel, payload) {
        const { requestId, statusCode, headers, body } = payload;

        const pending = tunnel.getPendingRequest(requestId);
        if (!pending) {
            this.logger.warn(`No pending request found: ${requestId}`);
            return;
        }

        tunnel.removePendingRequest(requestId);

        pending.resolve({
            statusCode,
            headers,
            body,
        });

        this.logger.debug(`Response received: ${requestId}`, { statusCode });
    }

    /**
     * Handles an error response from a tunnel client
     * @param {Object} tunnel - Tunnel object
     * @param {Object} payload - Error payload
     */
    handleError(tunnel, payload) {
        const { requestId, error, code } = payload;

        const pending = tunnel.getPendingRequest(requestId);
        if (!pending) {
            this.logger.warn(`No pending request for error: ${requestId}`);
            return;
        }

        tunnel.removePendingRequest(requestId);

        const err = new Error(error);
        err.code = code;
        pending.reject(err);

        this.logger.debug(`Error received: ${requestId}`, { error, code });
    }
}

module.exports = RequestForwarder;
