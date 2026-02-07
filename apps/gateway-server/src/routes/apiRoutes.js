/**
 * API Routes - Dashboard and management endpoints
 */

const express = require('express');
const { createLogger } = require('@devtunnel/shared');

const logger = createLogger({ name: 'ApiRoutes' });

function createApiRouter(app) {
    const router = express.Router();

    // Parse JSON for API
    router.use(express.json());

    // Get all tunnels
    router.get('/tunnels', (req, res) => {
        const tunnels = app.tunnelManager.getAllStats();
        res.json({ tunnels, count: tunnels.length });
    });

    // Get tunnel by ID
    router.get('/tunnels/:id', (req, res) => {
        const tunnel = app.tunnelManager.getTunnelById(req.params.id);
        if (!tunnel) {
            return res.status(404).json({ error: 'Tunnel not found' });
        }
        res.json(tunnel.getStats());
    });

    // Get traffic/inspector data
    router.get('/traffic', (req, res) => {
        const traffic = app.inspectorService.getAllTraffic(req.query);
        res.json({ traffic, count: traffic.length });
    });

    // Get traffic by tunnel
    router.get('/traffic/tunnel/:tunnelId', (req, res) => {
        const traffic = app.inspectorService.getTrafficByTunnel(req.params.tunnelId, req.query);
        res.json({ traffic, count: traffic.length });
    });

    // Get specific request
    router.get('/traffic/:requestId', (req, res) => {
        const traffic = app.inspectorService.getTrafficById(req.params.requestId);
        if (!traffic) {
            return res.status(404).json({ error: 'Request not found' });
        }
        res.json(traffic);
    });

    // Get curl command
    router.get('/traffic/:requestId/curl', (req, res) => {
        const curl = app.inspectorService.getCurlCommand(req.params.requestId);
        if (!curl) {
            return res.status(404).json({ error: 'Request not found' });
        }
        res.json({ curl });
    });

    // Get stats
    router.get('/stats', (req, res) => {
        res.json({
            tunnels: app.tunnelManager.getTunnelCount(),
            traffic: app.inspectorService.getStats(),
            uptime: process.uptime(),
        });
    });

    return router;
}

module.exports = createApiRouter;
