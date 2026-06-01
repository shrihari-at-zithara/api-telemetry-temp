/**
 * Minimal structured logger for library diagnostics.
 * @module utils/logger
 */

const { logLevel: configuredLevel } = require('../config');

const LEVELS = Object.freeze({
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
});

/**
 * @param {string} level
 * @returns {boolean}
 */
function shouldLog(level) {
  const current = LEVELS[configuredLevel] ?? LEVELS.info;
  const target = LEVELS[level] ?? LEVELS.info;
  return target <= current;
}

/**
 * @param {'error'|'warn'|'info'|'debug'} level
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
function write(level, message, meta) {
  if (!shouldLog(level)) {
    return;
  }

  const entry = {
    level,
    message,
    service: 'api-telemetry-lib',
    timestamp: new Date().toISOString(),
    ...(meta && { meta }),
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

const logger = {
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  debug: (message, meta) => write('debug', message, meta),
};

module.exports = logger;
