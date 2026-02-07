/**
 * Public Routes - Handles incoming tunnel traffic
 */

const express = require('express');
const { createLogger, ERROR_CODES } = require('@devtunnel/shared');

const logger = createLogger({ name: 'PublicRoutes' });

function createPublicRouter(app) {
    const router = express.Router();

    router.all('*', async (req, res, next) => {
        if (!req.isTunnelRequest || !req.subdomain) {
            return res.status(200).json({
                name: 'DevTunnel+',
                version: '1.0.0',
                description: 'Developer Tunneling Platform',
                documentation: '/api/docs',
                health: '/health',
            });
        }

        try {
            await app.requestForwarder.forwardRequest({
                subdomain: req.subdomain,
                req,
                res,
            });
        } catch (error) {
            logger.error('Request forwarding error', { error: error.message });
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    });

    return router;
}

module.exports = createPublicRouter;
