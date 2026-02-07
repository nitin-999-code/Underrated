# DevTunnel+

A complete developer tunneling platform similar to ngrok with advanced debugging and security features.

## 🎯 Phase 1: Tunnel MVP (Complete)

- ✅ WebSocket-based tunnel connections
- ✅ Public URL generation with subdomain support
- ✅ HTTP request forwarding to local servers
- ✅ Response streaming back to clients
- ✅ Request inspection and logging
- ✅ CLI with colored terminal output
- ✅ API endpoints for traffic inspection

## 📁 Project Structure

```
devtunnel-plus/
├── apps/
│   ├── gateway-server/     # Main gateway server (Express + WebSocket)
│   │   ├── src/
│   │   │   ├── index.js            # Entry point with config
│   │   │   ├── app.js              # Express app setup
│   │   │   ├── routes/             # API and public routes
│   │   │   ├── services/           # Business logic
│   │   │   └── websocket/          # WebSocket handlers
│   │   └── package.json
│   ├── cli-client/         # Command-line client
│   │   ├── src/
│   │   │   ├── index.js            # CLI entry (commander.js)
│   │   │   └── commands/           # CLI commands
│   │   └── package.json
│   └── dashboard/          # Web dashboard (Phase 2)
│       └── package.json
├── packages/
│   └── shared/             # Shared utilities and protocol
│       ├── src/
│       │   ├── protocol.js         # WebSocket protocol messages
│       │   ├── constants.js        # Shared constants
│       │   ├── logger.js           # Event-driven logging
│       │   └── utils.js            # Utility functions
│       └── __tests__/              # Unit tests
├── test-server.js          # Simple test server for validation
└── package.json            # Root workspace config
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Gateway Server

```bash
npm run dev:gateway
```

The gateway will start on:
- HTTP: http://localhost:3000
- WebSocket: ws://localhost:3001

### 3. Start a Local Server (for testing)

In a new terminal:

```bash
node test-server.js
```

This starts a test server on http://localhost:8080

### 4. Create a Tunnel

In another terminal:

```bash
cd apps/cli-client
node src/index.js http 8080
```

This will:
- Connect to the gateway via WebSocket
- Create a tunnel to your local port 8080
- Display the public URL

### 5. Test the Tunnel

```bash
# Replace {subdomain} with your assigned subdomain
curl -H "Host: {subdomain}.localhost:3000" http://localhost:3000/test
```

## 💻 CLI Commands

```bash
# Create HTTP tunnel
devtunnel http <port> [options]

# Options:
#   -s, --subdomain <name>    Request specific subdomain
#   -h, --host <host>         Gateway host (default: localhost)
#   -p, --gateway-port <port> Gateway WS port (default: 3001)
#   --inspect                 Enable request logging (default: true)
#   --no-inspect             Disable request logging

# Check gateway status
devtunnel status
```

## 🔌 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/tunnels` | List all tunnels |
| `GET /api/tunnels/:id` | Get tunnel details |
| `GET /api/traffic` | Get captured traffic |
| `GET /api/traffic/:requestId` | Get specific request |
| `GET /api/traffic/:requestId/curl` | Get curl command |
| `GET /api/stats` | Get statistics |

## 🏗️ Architecture

### Gateway Server
- Express HTTP server for public traffic
- WebSocket server for CLI tunnel connections
- Request forwarding with timeout handling
- Traffic inspection and in-memory storage

### CLI Client  
- Commander.js for CLI interface
- WebSocket client for tunnel connection
- HTTP client for local request forwarding
- Colored terminal output with chalk

### Shared Package
- Protocol message definitions
- Utility functions (ID generators, formatters)
- Constants and error codes
- Event-driven logging system

## 🧪 Testing

```bash
# Run shared package tests
npm test --workspace=packages/shared

# Expected output: 17 tests passing
```

## 📝 Development Phases

- [x] **Phase 1**: Tunnel MVP + Request Forwarding ← Current
- [ ] **Phase 2**: Smart Inspector + Dashboard
- [ ] **Phase 3**: Replay + Time Travel
- [ ] **Phase 4**: Security + Rate Limits
- [ ] **Phase 5**: Webhook Retry + Metrics + QR

## 📜 License

MIT
