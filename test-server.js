/**
 * Simple Test Server
 * Use this to test the tunnel functionality
 */

const http = require('http');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] ${req.method} ${req.url}`);

    // Collect body
    let body = '';
    req.on('data', chunk => body += chunk);

    req.on('end', () => {
        // Echo back request info
        const response = {
            message: 'Hello from local server!',
            timestamp,
            request: {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: body || null,
            },
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response, null, 2));
    });
});

server.listen(PORT, () => {
    console.log(`\n🚀 Test server running on http://localhost:${PORT}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET  /           - Returns JSON with request info`);
    console.log(`  POST /           - Echoes back posted data`);
    console.log(`  *    /*          - Works with any method/path`);
    console.log(`\nPress Ctrl+C to stop\n`);
});
