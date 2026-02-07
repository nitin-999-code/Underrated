/**
 * Tests for shared utilities
 */

const {
    generateSubdomain,
    generateRequestId,
    generateTunnelId,
    isValidSubdomain,
    formatBytes,
    formatDuration,
    safeJsonParse,
    truncate,
    calculateBackoff,
} = require('../src/utils');

describe('Utility Functions', () => {
    describe('generateSubdomain', () => {
        it('should generate 8 character subdomain', () => {
            const subdomain = generateSubdomain();
            expect(subdomain).toHaveLength(8);
            expect(subdomain).toMatch(/^[a-z0-9]+$/);
        });

        it('should generate unique values', () => {
            const set = new Set();
            for (let i = 0; i < 100; i++) {
                set.add(generateSubdomain());
            }
            expect(set.size).toBe(100);
        });
    });

    describe('isValidSubdomain', () => {
        it('should accept valid subdomains', () => {
            expect(isValidSubdomain('test1234')).toBe(true);
            expect(isValidSubdomain('my-app')).toBe(true);
            expect(isValidSubdomain('api-v2')).toBe(true);
        });

        it('should reject invalid subdomains', () => {
            expect(isValidSubdomain('')).toBe(false);
            expect(isValidSubdomain('ab')).toBe(false); // too short
            expect(isValidSubdomain('Test')).toBe(false); // uppercase
            expect(isValidSubdomain('-test')).toBe(false); // starts with dash
            expect(isValidSubdomain('test-')).toBe(false); // ends with dash
        });
    });

    describe('formatBytes', () => {
        it('should format bytes correctly', () => {
            expect(formatBytes(0)).toBe('0 B');
            expect(formatBytes(1024)).toBe('1 KB');
            expect(formatBytes(1048576)).toBe('1 MB');
        });
    });

    describe('formatDuration', () => {
        it('should format durations correctly', () => {
            expect(formatDuration(500)).toBe('500ms');
            expect(formatDuration(1500)).toBe('1.50s');
            expect(formatDuration(90000)).toBe('1.50m');
        });
    });

    describe('safeJsonParse', () => {
        it('should parse valid JSON', () => {
            expect(safeJsonParse('{"a": 1}')).toEqual({ a: 1 });
        });

        it('should return null for invalid JSON', () => {
            expect(safeJsonParse('not json')).toBeNull();
        });
    });

    describe('truncate', () => {
        it('should truncate long strings', () => {
            const long = 'a'.repeat(200);
            const result = truncate(long, 100);
            expect(result).toHaveLength(100);
            expect(result.endsWith('...')).toBe(true);
        });

        it('should not truncate short strings', () => {
            expect(truncate('short', 100)).toBe('short');
        });
    });

    describe('calculateBackoff', () => {
        it('should calculate exponential backoff', () => {
            const delay0 = calculateBackoff(0, 1000, 60000);
            const delay1 = calculateBackoff(1, 1000, 60000);
            const delay2 = calculateBackoff(2, 1000, 60000);

            // With jitter, we check ranges
            expect(delay0).toBeGreaterThanOrEqual(750);
            expect(delay0).toBeLessThanOrEqual(1250);
            expect(delay1).toBeGreaterThan(delay0 * 0.8);
        });
    });
});
