/**
 * Protocol Messages for WebSocket Communication
 * 
 * Defines the message types and formats used for tunnel communication
 * between the gateway server and CLI clients.
 */

// Message Types - enumeration of all protocol message types
const MessageType = {
    // Connection lifecycle
    TUNNEL_REGISTER: 'tunnel:register',
    TUNNEL_REGISTERED: 'tunnel:registered',
    TUNNEL_CLOSE: 'tunnel:close',
    TUNNEL_CLOSED: 'tunnel:closed',

    // Request/Response forwarding
    HTTP_REQUEST: 'http:request',
    HTTP_RESPONSE: 'http:response',
    HTTP_ERROR: 'http:error',

    // Heartbeat/keepalive
    PING: 'ping',
    PONG: 'pong',

    // Error handling
    ERROR: 'error',

    // Inspection events (for dashboard)
    INSPECT_REQUEST: 'inspect:request',
    INSPECT_RESPONSE: 'inspect:response',

    // Replay
    REPLAY_REQUEST: 'replay:request',
    REPLAY_RESPONSE: 'replay:response',
};

/**
 * Creates a tunnel registration message
 * @param {Object} options - Registration options
 * @param {string} options.subdomain - Requested subdomain (optional)
 * @param {number} options.localPort - Local port being tunneled
 * @param {string} options.authToken - Authentication token (optional)
 * @returns {Object} Protocol message
 */
function createTunnelRegisterMessage({ subdomain, localPort, authToken }) {
    return {
        type: MessageType.TUNNEL_REGISTER,
        payload: {
            subdomain,
            localPort,
            authToken,
            timestamp: Date.now(),
        },
    };
}

/**
 * Creates a tunnel registered confirmation message
 * @param {Object} options - Registration confirmation
 * @param {string} options.tunnelId - Assigned tunnel ID
 * @param {string} options.publicUrl - Public URL for the tunnel
 * @param {string} options.subdomain - Assigned subdomain
 * @returns {Object} Protocol message
 */
function createTunnelRegisteredMessage({ tunnelId, publicUrl, subdomain }) {
    return {
        type: MessageType.TUNNEL_REGISTERED,
        payload: {
            tunnelId,
            publicUrl,
            subdomain,
            timestamp: Date.now(),
        },
    };
}

/**
 * Creates an HTTP request forwarding message
 * @param {Object} options - Request details
 * @param {string} options.requestId - Unique request ID
 * @param {string} options.method - HTTP method
 * @param {string} options.path - Request path
 * @param {Object} options.headers - Request headers
 * @param {string|Buffer} options.body - Request body
 * @param {string} options.query - Query string
 * @returns {Object} Protocol message
 */
function createHttpRequestMessage({ requestId, method, path, headers, body, query }) {
    return {
        type: MessageType.HTTP_REQUEST,
        payload: {
            requestId,
            method,
            path,
            headers,
            body: body ? (Buffer.isBuffer(body) ? body.toString('base64') : body) : null,
            query,
            timestamp: Date.now(),
        },
    };
}

/**
 * Creates an HTTP response message
 * @param {Object} options - Response details
 * @param {string} options.requestId - Original request ID
 * @param {number} options.statusCode - HTTP status code
 * @param {Object} options.headers - Response headers
 * @param {string|Buffer} options.body - Response body
 * @returns {Object} Protocol message
 */
function createHttpResponseMessage({ requestId, statusCode, headers, body }) {
    return {
        type: MessageType.HTTP_RESPONSE,
        payload: {
            requestId,
            statusCode,
            headers,
            body: body ? (Buffer.isBuffer(body) ? body.toString('base64') : body) : null,
            timestamp: Date.now(),
        },
    };
}

/**
 * Creates an HTTP error message
 * @param {Object} options - Error details
 * @param {string} options.requestId - Original request ID
 * @param {string} options.error - Error message
 * @param {string} options.code - Error code
 * @returns {Object} Protocol message
 */
function createHttpErrorMessage({ requestId, error, code }) {
    return {
        type: MessageType.HTTP_ERROR,
        payload: {
            requestId,
            error,
            code,
            timestamp: Date.now(),
        },
    };
}

/**
 * Creates a ping message for keepalive
 * @returns {Object} Protocol message
 */
function createPingMessage() {
    return {
        type: MessageType.PING,
        payload: { timestamp: Date.now() },
    };
}

/**
 * Creates a pong response message
 * @param {number} pingTimestamp - Original ping timestamp
 * @returns {Object} Protocol message
 */
function createPongMessage(pingTimestamp) {
    return {
        type: MessageType.PONG,
        payload: {
            pingTimestamp,
            timestamp: Date.now(),
        },
    };
}

/**
 * Creates an error message
 * @param {string} error - Error message
 * @param {string} code - Error code
 * @returns {Object} Protocol message
 */
function createErrorMessage(error, code = 'GENERIC_ERROR') {
    return {
        type: MessageType.ERROR,
        payload: {
            error,
            code,
            timestamp: Date.now(),
        },
    };
}

/**
 * Creates a tunnel close message
 * @param {string} tunnelId - Tunnel ID to close
 * @param {string} reason - Reason for closing
 * @returns {Object} Protocol message
 */
function createTunnelCloseMessage(tunnelId, reason = 'Client requested close') {
    return {
        type: MessageType.TUNNEL_CLOSE,
        payload: {
            tunnelId,
            reason,
            timestamp: Date.now(),
        },
    };
}

/**
 * Parses a raw message into a typed protocol message
 * @param {string|Buffer} data - Raw message data
 * @returns {Object|null} Parsed message or null if invalid
 */
function parseMessage(data) {
    try {
        const str = Buffer.isBuffer(data) ? data.toString('utf8') : data;
        const parsed = JSON.parse(str);

        if (!parsed.type || !MessageType[Object.keys(MessageType).find(k => MessageType[k] === parsed.type)]) {
            return null;
        }

        return parsed;
    } catch (error) {
        return null;
    }
}

/**
 * Serializes a message for transmission
 * @param {Object} message - Protocol message
 * @returns {string} JSON string
 */
function serializeMessage(message) {
    return JSON.stringify(message);
}

module.exports = {
    MessageType,
    createTunnelRegisterMessage,
    createTunnelRegisteredMessage,
    createHttpRequestMessage,
    createHttpResponseMessage,
    createHttpErrorMessage,
    createPingMessage,
    createPongMessage,
    createErrorMessage,
    createTunnelCloseMessage,
    parseMessage,
    serializeMessage,
};
