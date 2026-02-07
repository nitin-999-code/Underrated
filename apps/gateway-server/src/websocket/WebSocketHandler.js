/**
 * WebSocket Handler
 * 
 * Manages WebSocket connections from CLI clients,
 * handles protocol messages, and coordinates tunnel operations.
 */

const {
    createLogger,
    parseMessage,
    serializeMessage,
    createTunnelRegisteredMessage,
    createErrorMessage,
    createPongMessage,
    MessageType,
    TUNNEL_CONFIG,
} = require('@devtunnel/shared');

class WebSocketHandler {
    constructor(wss, tunnelManager, requestForwarder, config) {
        this.wss = wss;
        this.tunnelManager = tunnelManager;
        this.requestForwarder = requestForwarder;
        this.config = config;
        this.logger = createLogger({ name: 'WebSocketHandler' });

        // Track WebSocket client metadata
        this.clientMetadata = new Map();

        // Setup connection handler
        this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));

        // Setup heartbeat interval
        this.heartbeatInterval = setInterval(() => this.pingAll(), TUNNEL_CONFIG.HEARTBEAT_INTERVAL);
    }

    /**
     * Handles a new WebSocket connection
     * @param {WebSocket} ws - WebSocket connection
     * @param {http.IncomingMessage} req - HTTP upgrade request
     */
    handleConnection(ws, req) {
        const clientIp = req.socket.remoteAddress;
        const clientId = `${clientIp}:${Date.now()}`;

        this.logger.info(`Client connected: ${clientId}`);

        // Store client metadata
        this.clientMetadata.set(ws, {
            clientId,
            clientIp,
            connectedAt: Date.now(),
            lastPing: Date.now(),
            isAlive: true,
        });

        // Setup message handler
        ws.on('message', (data) => this.handleMessage(ws, data));

        // Setup error handler
        ws.on('error', (error) => {
            this.logger.error(`WebSocket error: ${clientId}`, { error: error.message });
        });

        // Setup close handler
        ws.on('close', (code, reason) => {
            this.logger.info(`Client disconnected: ${clientId}`, { code, reason: reason?.toString() });
            this.handleDisconnect(ws);
        });

        // Setup pong handler
        ws.on('pong', () => {
            const metadata = this.clientMetadata.get(ws);
            if (metadata) {
                metadata.isAlive = true;
                metadata.lastPing = Date.now();
            }
        });
    }

    /**
     * Handles an incoming WebSocket message
     * @param {WebSocket} ws - WebSocket connection
     * @param {Buffer|string} data - Raw message data
     */
    handleMessage(ws, data) {
        const message = parseMessage(data);

        if (!message) {
            this.logger.warn('Invalid message received');
            this.send(ws, createErrorMessage('Invalid message format', 'INVALID_MESSAGE'));
            return;
        }

        this.logger.debug(`Message received: ${message.type}`, { payload: message.payload });

        switch (message.type) {
            case MessageType.TUNNEL_REGISTER:
                this.handleTunnelRegister(ws, message.payload);
                break;

            case MessageType.TUNNEL_CLOSE:
                this.handleTunnelClose(ws, message.payload);
                break;

            case MessageType.HTTP_RESPONSE:
                this.handleHttpResponse(ws, message.payload);
                break;

            case MessageType.HTTP_ERROR:
                this.handleHttpError(ws, message.payload);
                break;

            case MessageType.PING:
                this.send(ws, createPongMessage(message.payload.timestamp));
                break;

            case MessageType.PONG:
                // Handled by ws.on('pong') above
                break;

            default:
                this.logger.warn(`Unknown message type: ${message.type}`);
                this.send(ws, createErrorMessage(`Unknown message type: ${message.type}`, 'UNKNOWN_MESSAGE'));
        }
    }

    /**
     * Handles tunnel registration request
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} payload - Registration payload
     */
    handleTunnelRegister(ws, payload) {
        const { subdomain, localPort, authToken } = payload;

        this.logger.info(`Tunnel registration request`, { subdomain, localPort });

        // Get client metadata
        const metadata = this.clientMetadata.get(ws);

        // Register the tunnel
        const result = this.tunnelManager.registerTunnel({
            ws,
            requestedSubdomain: subdomain,
            localPort,
            clientInfo: {
                clientId: metadata?.clientId,
                clientIp: metadata?.clientIp,
                authToken,
            },
        });

        if (result.success) {
            const { tunnel } = result;

            // Construct public URL
            const publicUrl = this.buildPublicUrl(tunnel.subdomain);

            // Send success response
            this.send(ws, createTunnelRegisteredMessage({
                tunnelId: tunnel.tunnelId,
                publicUrl,
                subdomain: tunnel.subdomain,
            }));

            this.logger.info(`Tunnel registered: ${tunnel.subdomain}`, {
                tunnelId: tunnel.tunnelId,
                publicUrl,
            });
        } else {
            // Send error response
            this.send(ws, createErrorMessage(result.error, result.code));
            this.logger.warn(`Tunnel registration failed`, { error: result.error, code: result.code });
        }
    }

    /**
     * Handles tunnel close request
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} payload - Close payload
     */
    handleTunnelClose(ws, payload) {
        const { tunnelId, reason } = payload;

        this.tunnelManager.closeTunnel(tunnelId, reason || 'Client requested close');

        this.logger.info(`Tunnel closed by client: ${tunnelId}`, { reason });
    }

    /**
     * Handles HTTP response from client
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} payload - Response payload
     */
    handleHttpResponse(ws, payload) {
        // Find tunnel for this WebSocket
        const tunnels = this.tunnelManager.getTunnelsByWs(ws);

        for (const tunnel of tunnels) {
            const pending = tunnel.getPendingRequest(payload.requestId);
            if (pending) {
                this.requestForwarder.handleResponse(tunnel, payload);
                return;
            }
        }

        this.logger.warn(`No tunnel found for response: ${payload.requestId}`);
    }

    /**
     * Handles HTTP error from client
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} payload - Error payload
     */
    handleHttpError(ws, payload) {
        // Find tunnel for this WebSocket
        const tunnels = this.tunnelManager.getTunnelsByWs(ws);

        for (const tunnel of tunnels) {
            const pending = tunnel.getPendingRequest(payload.requestId);
            if (pending) {
                this.requestForwarder.handleError(tunnel, payload);
                return;
            }
        }

        this.logger.warn(`No tunnel found for error: ${payload.requestId}`);
    }

    /**
     * Handles client disconnection
     * @param {WebSocket} ws - WebSocket connection
     */
    handleDisconnect(ws) {
        // Close all tunnels for this connection
        this.tunnelManager.closeTunnelsForWs(ws, 'Client disconnected');

        // Clean up metadata
        this.clientMetadata.delete(ws);
    }

    /**
     * Sends a message to a WebSocket client
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Message to send
     */
    send(ws, message) {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(serializeMessage(message));
        }
    }

    /**
     * Pings all connected clients to check liveness
     */
    pingAll() {
        for (const [ws, metadata] of this.clientMetadata) {
            if (!metadata.isAlive) {
                // Client didn't respond to last ping, terminate
                this.logger.warn(`Client unresponsive, terminating: ${metadata.clientId}`);
                ws.terminate();
                this.handleDisconnect(ws);
                continue;
            }

            metadata.isAlive = false;
            ws.ping();
        }
    }

    /**
     * Builds the public URL for a subdomain
     * @param {string} subdomain - Tunnel subdomain
     * @returns {string} Public URL
     */
    buildPublicUrl(subdomain) {
        const port = this.config.httpPort !== 80 && this.config.httpPort !== 443
            ? `:${this.config.httpPort}`
            : '';
        return `http://${subdomain}.${this.config.publicDomain}${port}`;
    }

    /**
     * Stops the WebSocket handler
     */
    stop() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
    }

    /**
     * Gets connected client count
     * @returns {number} Number of connected clients
     */
    getClientCount() {
        return this.clientMetadata.size;
    }

    /**
     * Gets all client metadata
     * @returns {Object[]} Array of client metadata
     */
    getAllClients() {
        return Array.from(this.clientMetadata.values());
    }
}

module.exports = WebSocketHandler;
