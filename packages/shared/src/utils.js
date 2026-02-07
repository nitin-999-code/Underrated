/**
 * Shared Utilities for DevTunnel+
 * 
 * Common utility functions used across the platform.
 */

const { customAlphabet } = require('nanoid');
const { TUNNEL_CONFIG } = require('./constants');

// Custom nanoid generator for subdomains (lowercase alphanumeric)
const generateSubdomain = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

// Generate unique request IDs
const generateRequestId = customAlphabet('0123456789abcdef', 16);

// Generate unique tunnel IDs
const generateTunnelId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 12);

// Generate auth tokens
const generateAuthToken = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 32);

/**
 * Validates a subdomain string
 * @param {string} subdomain - Subdomain to validate
 * @returns {boolean} True if valid
 */
function isValidSubdomain(subdomain) {
    if (!subdomain || typeof subdomain !== 'string') return false;
    if (subdomain.length < TUNNEL_CONFIG.SUBDOMAIN_MIN_LENGTH) return false;
    if (subdomain.length > TUNNEL_CONFIG.SUBDOMAIN_MAX_LENGTH) return false;
    return TUNNEL_CONFIG.SUBDOMAIN_PATTERN.test(subdomain);
}

/**
 * Formats bytes into human-readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formats duration in milliseconds to human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Safely parses JSON, returning null on error
 * @param {string} str - JSON string to parse
 * @returns {Object|null} Parsed object or null
 */
function safeJsonParse(str) {
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
}

/**
 * Deep clones an object using JSON serialization
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Creates a deferred promise with resolve/reject exposed
 * @returns {Object} Object with promise, resolve, and reject
 */
function createDeferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

/**
 * Waits for a specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise} Promise that resolves after the duration
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Truncates a string to a maximum length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
function truncate(str, maxLength = 100) {
    if (!str || str.length <= maxLength) return str;
    return `${str.substring(0, maxLength - 3)}...`;
}

/**
 * Sanitizes headers for logging (removes sensitive data)
 * @param {Object} headers - Headers object
 * @returns {Object} Sanitized headers
 */
function sanitizeHeaders(headers) {
    const sensitiveKeys = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];
    const sanitized = { ...headers };

    for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.includes(key.toLowerCase())) {
            sanitized[key] = '[REDACTED]';
        }
    }

    return sanitized;
}

/**
 * Extracts the content type from headers
 * @param {Object} headers - Headers object
 * @returns {string} Content type or empty string
 */
function getContentType(headers) {
    const contentType = headers['content-type'] || headers['Content-Type'] || '';
    return contentType.split(';')[0].trim();
}

/**
 * Checks if content type is JSON
 * @param {string} contentType - Content type string
 * @returns {boolean} True if JSON
 */
function isJsonContentType(contentType) {
    return contentType.includes('application/json') || contentType.includes('+json');
}

/**
 * Calculates exponential backoff delay
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in ms
 * @param {number} maxDelay - Maximum delay in ms
 * @returns {number} Delay in milliseconds
 */
function calculateBackoff(attempt, baseDelay = 1000, maxDelay = 60000) {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
}

/**
 * Masks sensitive data in a URL
 * @param {string} url - URL to mask
 * @returns {string} Masked URL
 */
function maskUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.password) {
            parsed.password = '****';
        }
        return parsed.toString();
    } catch {
        return url;
    }
}

module.exports = {
    generateSubdomain,
    generateRequestId,
    generateTunnelId,
    generateAuthToken,
    isValidSubdomain,
    formatBytes,
    formatDuration,
    safeJsonParse,
    deepClone,
    createDeferred,
    sleep,
    truncate,
    sanitizeHeaders,
    getContentType,
    isJsonContentType,
    calculateBackoff,
    maskUrl,
};
