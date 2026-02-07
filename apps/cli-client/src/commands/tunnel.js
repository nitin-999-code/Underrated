/**
 * Tunnel Command - Creates and manages tunnel connections
 */

const WebSocket = require('ws');
const chalk = require('chalk');
const ora = require('ora');
const boxen = require('boxen');
const http = require('http');
const {
    createLogger,
    createTunnelRegisterMessage,
    createHttpResponseMessage,
    createHttpErrorMessage,
    parseMessage,
    serializeMessage,
    MessageType,
    LOG_LEVELS,
} = require('@devtunnel/shared');

const logger = createLogger({ name: 'Tunnel', level: LOG_LEVELS.INFO });

class TunnelClient {
    constructor(localPort, options) {
        this.localPort = localPort;
        this.options = options;
        this.ws = null;
        this.tunnelId = null;
        this.publicUrl = null;
        this.subdomain = null;
        this.isConnected = false;
        this.requestCount = 0;
    }

    async connect() {
        const spinner = ora('Connecting to gateway...').start();

        return new Promise((resolve, reject) => {
            const wsUrl = `ws://${this.options.host}:${this.options.gatewayPort}`;

            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                spinner.text = 'Registering tunnel...';

                // Send registration message
                const registerMsg = createTunnelRegisterMessage({
                    subdomain: this.options.subdomain,
                    localPort: this.localPort,
                });

                this.ws.send(serializeMessage(registerMsg));
            });

            this.ws.on('message', (data) => {
                const message = parseMessage(data);
                if (!message) return;

                this.handleMessage(message, spinner, resolve, reject);
            });

            this.ws.on('error', (error) => {
                spinner.fail(`Connection failed: ${error.message}`);
                reject(error);
            });

            this.ws.on('close', (code, reason) => {
                this.isConnected = false;
                if (this.tunnelId) {
                    console.log(chalk.yellow(`\nTunnel closed (code: ${code})`));
                }
            });

            // Timeout for connection
            setTimeout(() => {
                if (!this.isConnected) {
                    spinner.fail('Connection timeout');
                    this.ws.close();
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }

    handleMessage(message, spinner, resolve, reject) {
        switch (message.type) {
            case MessageType.TUNNEL_REGISTERED:
                this.handleRegistered(message.payload, spinner, resolve);
                break;

            case MessageType.HTTP_REQUEST:
                this.handleHttpRequest(message.payload);
                break;

            case MessageType.ERROR:
                if (spinner) spinner.fail(`Error: ${message.payload.error}`);
                if (reject) reject(new Error(message.payload.error));
                break;

            case MessageType.PING:
                this.ws.send(serializeMessage({ type: MessageType.PONG, payload: { timestamp: Date.now() } }));
                break;
        }
    }

    handleRegistered(payload, spinner, resolve) {
        this.tunnelId = payload.tunnelId;
        this.publicUrl = payload.publicUrl;
        this.subdomain = payload.subdomain;
        this.isConnected = true;

        spinner.succeed('Tunnel established!');
        this.displayTunnelInfo();
        resolve();
    }

    displayTunnelInfo() {
        const info = [
            '',
            chalk.bold.green('  DevTunnel+ is running!'),
            '',
            `  ${chalk.cyan('Public URL:')}    ${chalk.bold(this.publicUrl)}`,
            `  ${chalk.cyan('Subdomain:')}     ${this.subdomain}`,
            `  ${chalk.cyan('Forwarding to:')} http://localhost:${this.localPort}`,
            `  ${chalk.cyan('Tunnel ID:')}     ${this.tunnelId}`,
            '',
            chalk.gray('  Press Ctrl+C to stop'),
            '',
        ].join('\n');

        console.log(boxen(info, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan',
        }));

        if (this.options.inspect) {
            console.log(chalk.gray('  Request inspection enabled. Requests will be logged below.\n'));
        }
    }

    async handleHttpRequest(payload) {
        const { requestId, method, path, headers, body, query } = payload;
        const startTime = Date.now();
        this.requestCount++;

        // Log incoming request
        console.log(
            chalk.gray(`[${new Date().toLocaleTimeString()}]`) +
            ' ' +
            this.colorMethod(method) +
            ' ' +
            chalk.white(path)
        );

        try {
            // Forward to local server
            const response = await this.forwardToLocal(method, path, headers, body);
            const duration = Date.now() - startTime;

            // Send response back
            const responseMsg = createHttpResponseMessage({
                requestId,
                statusCode: response.statusCode,
                headers: response.headers,
                body: response.body,
            });

            this.ws.send(serializeMessage(responseMsg));

            // Log response
            console.log(
                chalk.gray(`[${new Date().toLocaleTimeString()}]`) +
                ' ' +
                this.colorStatus(response.statusCode) +
                ' ' +
                chalk.gray(`${duration}ms`)
            );

        } catch (error) {
            const duration = Date.now() - startTime;

            // Send error response
            const errorMsg = createHttpErrorMessage({
                requestId,
                error: error.message,
                code: 'LOCAL_SERVER_ERROR',
            });

            this.ws.send(serializeMessage(errorMsg));

            console.log(
                chalk.gray(`[${new Date().toLocaleTimeString()}]`) +
                ' ' +
                chalk.red(`ERR`) +
                ' ' +
                chalk.gray(error.message) +
                ' ' +
                chalk.gray(`${duration}ms`)
            );
        }
    }

    forwardToLocal(method, path, headers, body) {
        return new Promise((resolve, reject) => {
            // Parse path and query
            const url = new URL(path, `http://localhost:${this.localPort}`);

            const options = {
                hostname: 'localhost',
                port: this.localPort,
                path: url.pathname + url.search,
                method,
                headers: { ...headers, host: `localhost:${this.localPort}` },
            };

            const req = http.request(options, (res) => {
                const chunks = [];

                res.on('data', (chunk) => chunks.push(chunk));

                res.on('end', () => {
                    const responseBody = Buffer.concat(chunks);
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: responseBody.toString('base64'),
                    });
                });
            });

            req.on('error', reject);

            // Send body if present
            if (body) {
                const bodyBuffer = Buffer.from(body, 'base64');
                req.write(bodyBuffer);
            }

            req.end();
        });
    }

    colorMethod(method) {
        const colors = {
            GET: chalk.green,
            POST: chalk.blue,
            PUT: chalk.yellow,
            PATCH: chalk.yellow,
            DELETE: chalk.red,
        };
        return (colors[method] || chalk.white)(method.padEnd(6));
    }

    colorStatus(status) {
        if (status >= 500) return chalk.red(status);
        if (status >= 400) return chalk.yellow(status);
        if (status >= 300) return chalk.cyan(status);
        if (status >= 200) return chalk.green(status);
        return chalk.white(status);
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

async function execute(port, options) {
    if (!port || isNaN(port)) {
        console.error(chalk.red('Error: Please provide a valid port number'));
        process.exit(1);
    }

    const client = new TunnelClient(port, options);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log(chalk.yellow('\nShutting down tunnel...'));
        client.close();
        process.exit(0);
    });

    try {
        await client.connect();
    } catch (error) {
        console.error(chalk.red(`Failed to establish tunnel: ${error.message}`));
        process.exit(1);
    }
}

module.exports = { execute, TunnelClient };
