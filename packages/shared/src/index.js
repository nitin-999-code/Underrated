/**
 * @devtunnel/shared - Shared utilities and protocol messages
 * 
 * This module exports all shared functionality used across the DevTunnel+ platform.
 */

const protocol = require('./protocol');
const constants = require('./constants');
const logger = require('./logger');
const utils = require('./utils');

module.exports = {
  ...protocol,
  ...constants,
  ...logger,
  ...utils,
};
