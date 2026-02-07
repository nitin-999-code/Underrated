/**
 * DevTunnel+ Gateway Server
 * 
 * Main entry point for the gateway server that handles:
 * - HTTP/HTTPS public traffic
 * - WebSocket connections from CLI clients
 * - Request forwarding and response streaming
 */

const { createLogger } = require('@devtunnel/shared');
const { DEFAULT_GATEWAY_PORT, DEFAULT_GATEWAY_WS_PORT } = require('@devtunnel/shared');
const GatewayApp = require('./app');

const logger = createLogger({ name: 'Gateway' });

// Configuration from environment or defaults
const config = {
    httpPort: parseInt(process.env.HTTP_PORT, 10) || DEFAULT_GATEWAY_PORT,
    wsPort: parseInt(process.env.WS_PORT, 10) || DEFAULT_GATEWAY_WS_PORT,
    host: process.env.HOST || 'localhost',
    publicDomain: process.env.PUBLIC_DOMAIN || 'localhost',
    dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3002',
};

/**
 * Bootstrap and start the gateway server
 */
async function main() {
    logger.info('Starting DevTunnel+ Gateway Server...', { config });

    try {
        const app = new GatewayApp(config);
        await app.start();

        logger.info(`🚀 Gateway HTTP Server running on http://${config.host}:${config.httpPort}`);
        logger.info(`🔌 Gateway WebSocket Server running on ws://${config.host}:${config.wsPort}`);
        logger.info(`🌐 Public domain: ${config.publicDomain}`);

        // Graceful shutdown handlers
        const shutdown = async (signal) => {
            logger.info(`Received ${signal}, shutting down gracefully...`);
            await app.stop();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

        // Unhandled rejection handler
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection', { reason: reason?.message || reason, promise });
        });

    } catch (error) {
        logger.error('Failed to start gateway server', { error: error.message });
        process.exit(1);
    }
}

main();
