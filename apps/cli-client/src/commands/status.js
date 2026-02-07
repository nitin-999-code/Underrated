/**
 * Status Command - Check gateway server status
 */

const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');

async function execute(options) {
    const spinner = ora('Checking gateway status...').start();
    const url = `http://${options.host}:${options.port}/health`;

    try {
        const response = await axios.get(url, { timeout: 5000 });
        const data = response.data;

        spinner.succeed('Gateway is online');
        console.log('');
        console.log(chalk.cyan('  Status:      ') + chalk.green(data.status));
        console.log(chalk.cyan('  Tunnels:     ') + chalk.white(data.tunnels));
        console.log(chalk.cyan('  Uptime:      ') + chalk.white(`${Math.floor(data.uptime)}s`));
        console.log('');
    } catch (error) {
        spinner.fail('Gateway is offline or unreachable');
        console.log(chalk.red(`  Error: ${error.message}`));
        process.exit(1);
    }
}

module.exports = { execute };
