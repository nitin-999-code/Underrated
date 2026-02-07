/**
 * Tests for shared protocol module
 */

const {
    MessageType,
    createTunnelRegisterMessage,
    createTunnelRegisteredMessage,
    createHttpRequestMessage,
    createHttpResponseMessage,
    createHttpErrorMessage,
    createPingMessage,
    createPongMessage,
    createErrorMessage,
    parseMessage,
    serializeMessage,
} = require('../src/protocol');

describe('Protocol Messages', () => {
    describe('MessageType', () => {
        it('should have all required message types', () => {
            expect(MessageType.TUNNEL_REGISTER).toBe('tunnel:register');
            expect(MessageType.TUNNEL_REGISTERED).toBe('tunnel:registered');
            expect(MessageType.HTTP_REQUEST).toBe('http:request');
            expect(MessageType.HTTP_RESPONSE).toBe('http:response');
            expect(MessageType.PING).toBe('ping');
            expect(MessageType.PONG).toBe('pong');
            expect(MessageType.ERROR).toBe('error');
        });
    });

    describe('createTunnelRegisterMessage', () => {
        it('should create valid register message', () => {
            const msg = createTunnelRegisterMessage({
                subdomain: 'test',
                localPort: 8080,
                authToken: 'token123',
            });

            expect(msg.type).toBe(MessageType.TUNNEL_REGISTER);
            expect(msg.payload.subdomain).toBe('test');
            expect(msg.payload.localPort).toBe(8080);
            expect(msg.payload.authToken).toBe('token123');
            expect(msg.payload.timestamp).toBeDefined();
        });
    });

    describe('createHttpRequestMessage', () => {
        it('should create valid HTTP request message', () => {
            const msg = createHttpRequestMessage({
                requestId: 'req123',
                method: 'POST',
                path: '/api/test',
                headers: { 'content-type': 'application/json' },
                body: '{"test": true}',
                query: { foo: 'bar' },
            });

            expect(msg.type).toBe(MessageType.HTTP_REQUEST);
            expect(msg.payload.requestId).toBe('req123');
            expect(msg.payload.method).toBe('POST');
            expect(msg.payload.path).toBe('/api/test');
        });
    });

    describe('parseMessage', () => {
        it('should parse valid JSON message', () => {
            const original = createPingMessage();
            const serialized = serializeMessage(original);
            const parsed = parseMessage(serialized);

            expect(parsed.type).toBe(MessageType.PING);
            expect(parsed.payload.timestamp).toBeDefined();
        });

        it('should return null for invalid JSON', () => {
            expect(parseMessage('not json')).toBeNull();
        });

        it('should return null for invalid message type', () => {
            expect(parseMessage('{"type": "invalid", "payload": {}}')).toBeNull();
        });
    });
});
