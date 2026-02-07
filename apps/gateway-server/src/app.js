/**
 * Gateway Application
 * 
 * Core application class that orchestrates:
 * - Express HTTP server for public traffic
 * - WebSocket server for tunnel connections
 * - Request routing and forwarding
 */

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { WebSocketServer } = require('ws');
const { createLogger } = require('@devtunnel/shared');

const TunnelManager = require('./services/TunnelManager');
const RequestForwarder = require('./services/RequestForwarder');
const InspectorService = require('./services/InspectorService');
const createPublicRouter = require('./routes/publicRoutes');
const createApiRouter = require('./routes/apiRoutes');
const WebSocketHandler = require('./websocket/WebSocketHandler');

class GatewayApp {
    constructor(config) {
        this.config = config;
        this.logger = createLogger({ name: 'GatewayApp' });

        // Initialize services
        this.tunnelManager = new TunnelManager();
        this.inspectorService = new InspectorService();
        this.requestForwarder = new RequestForwarder(this.tunnelManager, this.inspectorService);

        // Initialize Express app
        this.app = this.createExpressApp();
        this.httpServer = http.createServer(this.app);

        // Initialize WebSocket server
        this.wsServer = null;
        this.wsHandler = null;
    }

    /**
     * Creates and configures the Express application
     * @returns {express.Application} Configured Express app
     */
    createExpressApp() {
        const app = express();

        // Security middleware
        app.use(helmet({
            contentSecurityPolicy: false, // Allow tunneled content
        }));

        // CORS for API and dashboard access
        app.use(cors({
            origin: [this.config.dashboardUrl, 'http://localhost:3002'],
            credentials: true,
        }));

        // Compression for responses
        app.use(compression());

        // Raw body parsing for forwarding
        app.use(express.raw({ type: '*/*', limit: '10mb' }));

        // Request logging middleware
        app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                this.logger.debug(`${req.method} ${req.path}`, {
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    subdomain: req.subdomain,
                });
            });
            next();
        });

        // Subdomain extraction middleware
        app.use((req, res, next) => {
            const host = req.headers.host || '';
            const parts = host.split('.');

            // Check if request is for a tunnel subdomain
            // Format: {subdomain}.{domain}:{port} or {subdomain}.localhost:{port}
            if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'api') {
                req.subdomain = parts[0];
                req.isTunnelRequest = true;
            } else {
                req.isTunnelRequest = false;
            }

            next();
        });

        // API routes (for dashboard and management)
        app.use('/api', createApiRouter(this));

        // Health check
        app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                tunnels: this.tunnelManager.getTunnelCount(),
                uptime: process.uptime(),
            });
        });

        // Public tunnel routes (catch-all for subdomain-based routing)
        app.use('/', createPublicRouter(this));

        // Error handling middleware
        app.use((err, req, res, next) => {
            this.logger.error('Express error', { error: err.message, stack: err.stack });
            res.status(500).json({ error: 'Internal server error' });
        });

        return app;
    }

    /**
     * Starts the HTTP and WebSocket servers
     */
    async start() {
        return new Promise((resolve, reject) => {
            // Start HTTP server
            this.httpServer.listen(this.config.httpPort, this.config.host, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Start WebSocket server on separate port
                this.wsServer = new WebSocketServer({
                    port: this.config.wsPort,
                    host: this.config.host,
                });

                // Initialize WebSocket handler
                this.wsHandler = new WebSocketHandler(
                    this.wsServer,
                    this.tunnelManager,
                    this.requestForwarder,
                    this.config
                );

                this.wsServer.on('listening', () => {
                    this.logger.info('WebSocket server started');
                    resolve();
                });

                this.wsServer.on('error', (error) => {
                    this.logger.error('WebSocket server error', { error: error.message });
                    reject(error);
                });
            });

            this.httpServer.on('error', (err) => {
                this.logger.error('HTTP server error', { error: err.message });
                reject(err);
            });
        });
    }

    /**
     * Stops all servers gracefully
     */
    async stop() {
        this.logger.info('Stopping gateway...');

        // Close all tunnel connections
        this.tunnelManager.closeAll();

        // Close WebSocket server
        if (this.wsServer) {
            await new Promise((resolve) => {
                this.wsServer.close(resolve);
            });
        }

        // Close HTTP server
        await new Promise((resolve) => {
            this.httpServer.close(resolve);
        });

        this.logger.info('Gateway stopped');
    }
}

module.exports = GatewayApp;
