/**
 * Shared Constants for DevTunnel+
 * 
 * Centralized configuration values and constants used across the platform.
 */

// Default ports
const DEFAULT_GATEWAY_PORT = 3000;
const DEFAULT_GATEWAY_WS_PORT = 3001;
const DEFAULT_DASHBOARD_PORT = 3002;

// Tunnel configuration
const TUNNEL_CONFIG = {
    // Maximum number of tunnels per client
    MAX_TUNNELS_PER_CLIENT: 10,

    // Subdomain constraints
    SUBDOMAIN_MIN_LENGTH: 4,
    SUBDOMAIN_MAX_LENGTH: 32,
    SUBDOMAIN_PATTERN: /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,

    // Request timeout (ms)
    REQUEST_TIMEOUT: 30000,

    // Heartbeat interval (ms)
    HEARTBEAT_INTERVAL: 30000,

    // Max request body size (bytes)
    MAX_BODY_SIZE: 10 * 1024 * 1024, // 10MB

    // Traffic history retention (minutes)
    TRAFFIC_HISTORY_MINUTES: 60,

    // Max stored requests per tunnel
    MAX_STORED_REQUESTS: 1000,
};

// HTTP status codes
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
};

// Error codes
const ERROR_CODES = {
    // Connection errors
    CONNECTION_FAILED: 'CONNECTION_FAILED',
    CONNECTION_CLOSED: 'CONNECTION_CLOSED',
    CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',

    // Tunnel errors
    TUNNEL_NOT_FOUND: 'TUNNEL_NOT_FOUND',
    TUNNEL_LIMIT_EXCEEDED: 'TUNNEL_LIMIT_EXCEEDED',
    SUBDOMAIN_TAKEN: 'SUBDOMAIN_TAKEN',
    INVALID_SUBDOMAIN: 'INVALID_SUBDOMAIN',

    // Request errors
    REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
    REQUEST_FAILED: 'REQUEST_FAILED',
    INVALID_REQUEST: 'INVALID_REQUEST',
    BODY_TOO_LARGE: 'BODY_TOO_LARGE',

    // Auth errors
    UNAUTHORIZED: 'UNAUTHORIZED',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',

    // Rate limiting
    RATE_LIMITED: 'RATE_LIMITED',

    // Local server errors
    LOCAL_SERVER_ERROR: 'LOCAL_SERVER_ERROR',
    LOCAL_SERVER_UNREACHABLE: 'LOCAL_SERVER_UNREACHABLE',
};

// Log levels
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4,
};

// Webhook retry configuration
const WEBHOOK_RETRY_CONFIG = {
    MAX_RETRIES: 5,
    INITIAL_DELAY_MS: 1000,
    MAX_DELAY_MS: 60000,
    BACKOFF_MULTIPLIER: 2,
};

module.exports = {
    DEFAULT_GATEWAY_PORT,
    DEFAULT_GATEWAY_WS_PORT,
    DEFAULT_DASHBOARD_PORT,
    TUNNEL_CONFIG,
    HTTP_STATUS,
    ERROR_CODES,
    LOG_LEVELS,
    WEBHOOK_RETRY_CONFIG,
};
