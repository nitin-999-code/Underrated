/**
 * Shared Logger for DevTunnel+
 * 
 * Event-driven logging system with support for different log levels,
 * structured logging, and optional event emission for dashboard integration.
 */

const { EventEmitter } = require('events');
const { LOG_LEVELS } = require('./constants');

/**
 * Logger class with event-driven capabilities
 */
class Logger extends EventEmitter {
    constructor(options = {}) {
        super();
        this.name = options.name || 'DevTunnel+';
        this.level = options.level ?? LOG_LEVELS.INFO;
        this.colorEnabled = options.colorEnabled ?? true;
        this.timestampEnabled = options.timestampEnabled ?? true;
    }

    /**
     * ANSI color codes for terminal output
     */
    static COLORS = {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        dim: '\x1b[2m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        gray: '\x1b[90m',
    };

    /**
     * Level-specific color mappings
     */
    static LEVEL_COLORS = {
        ERROR: 'red',
        WARN: 'yellow',
        INFO: 'cyan',
        DEBUG: 'gray',
        TRACE: 'dim',
    };

    /**
     * Gets the current timestamp in ISO format
     * @returns {string} Formatted timestamp
     */
    getTimestamp() {
        return new Date().toISOString();
    }

    /**
     * Colorizes text if colors are enabled
     * @param {string} text - Text to colorize
     * @param {string} color - Color name
     * @returns {string} Colorized text
     */
    colorize(text, color) {
        if (!this.colorEnabled) return text;
        const colorCode = Logger.COLORS[color] || '';
        return `${colorCode}${text}${Logger.COLORS.reset}`;
    }

    /**
     * Formats a log entry
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} meta - Additional metadata
     * @returns {string} Formatted log entry
     */
    format(level, message, meta = {}) {
        const parts = [];

        if (this.timestampEnabled) {
            parts.push(this.colorize(`[${this.getTimestamp()}]`, 'gray'));
        }

        const levelColor = Logger.LEVEL_COLORS[level] || 'white';
        parts.push(this.colorize(`[${level}]`, levelColor));
        parts.push(this.colorize(`[${this.name}]`, 'magenta'));
        parts.push(message);

        if (Object.keys(meta).length > 0) {
            parts.push(this.colorize(JSON.stringify(meta), 'dim'));
        }

        return parts.join(' ');
    }

    /**
     * Core logging method
     * @param {number} level - Numeric log level
     * @param {string} levelName - Level name string
     * @param {string} message - Log message
     * @param {Object} meta - Additional metadata
     */
    log(level, levelName, message, meta = {}) {
        if (level > this.level) return;

        const formatted = this.format(levelName, message, meta);
        const logEntry = {
            timestamp: this.getTimestamp(),
            level: levelName,
            name: this.name,
            message,
            meta,
        };

        // Output to console
        if (level === LOG_LEVELS.ERROR) {
            console.error(formatted);
        } else if (level === LOG_LEVELS.WARN) {
            console.warn(formatted);
        } else {
            console.log(formatted);
        }

        // Emit event for external listeners (e.g., dashboard)
        this.emit('log', logEntry);
    }

    /**
     * Log an error message
     * @param {string} message - Error message
     * @param {Object} meta - Additional metadata
     */
    error(message, meta = {}) {
        this.log(LOG_LEVELS.ERROR, 'ERROR', message, meta);
    }

    /**
     * Log a warning message
     * @param {string} message - Warning message
     * @param {Object} meta - Additional metadata
     */
    warn(message, meta = {}) {
        this.log(LOG_LEVELS.WARN, 'WARN', message, meta);
    }

    /**
     * Log an info message
     * @param {string} message - Info message
     * @param {Object} meta - Additional metadata
     */
    info(message, meta = {}) {
        this.log(LOG_LEVELS.INFO, 'INFO', message, meta);
    }

    /**
     * Log a debug message
     * @param {string} message - Debug message
     * @param {Object} meta - Additional metadata
     */
    debug(message, meta = {}) {
        this.log(LOG_LEVELS.DEBUG, 'DEBUG', message, meta);
    }

    /**
     * Log a trace message
     * @param {string} message - Trace message
     * @param {Object} meta - Additional metadata
     */
    trace(message, meta = {}) {
        this.log(LOG_LEVELS.TRACE, 'TRACE', message, meta);
    }

    /**
     * Creates a child logger with a different name
     * @param {string} name - Child logger name
     * @returns {Logger} Child logger instance
     */
    child(name) {
        const child = new Logger({
            name: `${this.name}:${name}`,
            level: this.level,
            colorEnabled: this.colorEnabled,
            timestampEnabled: this.timestampEnabled,
        });

        // Forward events to parent
        child.on('log', (entry) => this.emit('log', entry));

        return child;
    }

    /**
     * Sets the log level
     * @param {number|string} level - New log level
     */
    setLevel(level) {
        if (typeof level === 'string') {
            this.level = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
        } else {
            this.level = level;
        }
    }
}

/**
 * Creates a new logger instance
 * @param {Object} options - Logger options
 * @returns {Logger} Logger instance
 */
function createLogger(options = {}) {
    return new Logger(options);
}

// Default logger instance
const defaultLogger = createLogger();

module.exports = {
    Logger,
    createLogger,
    defaultLogger,
    LOG_LEVELS,
};
