#!/usr/bin/env node

/**
 * DevTunnel+ CLI
 * Main entry point for the command-line interface
 */

const { program } = require('commander');
const packageJson = require('../package.json');
const tunnelCommand = require('./commands/tunnel');
const statusCommand = require('./commands/status');
const { createLogger, LOG_LEVELS } = require('@devtunnel/shared');

// Create logger
const logger = createLogger({ name: 'CLI', level: LOG_LEVELS.INFO });

// Setup program
program
    .name('devtunnel')
    .description('DevTunnel+ - Expose your local server to the internet')
    .version(packageJson.version);

// Tunnel command (main command)
program
    .command('http')
    .description('Create a tunnel to expose your local HTTP server')
    .argument('<port>', 'Local port to expose')
    .option('-s, --subdomain <subdomain>', 'Request a specific subdomain')
    .option('-h, --host <host>', 'Gateway server host', 'localhost')
    .option('-p, --gateway-port <port>', 'Gateway WebSocket port', '3001')
    .option('--inspect', 'Enable request inspection', true)
    .option('--no-inspect', 'Disable request inspection')
    .action((port, options) => {
        tunnelCommand.execute(parseInt(port, 10), options);
    });

// Status command
program
    .command('status')
    .description('Check status of gateway server')
    .option('-h, --host <host>', 'Gateway server host', 'localhost')
    .option('-p, --port <port>', 'Gateway HTTP port', '3000')
    .action((options) => {
        statusCommand.execute(options);
    });

// Parse arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
