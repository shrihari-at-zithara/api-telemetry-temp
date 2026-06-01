/**
 * Map library errors to HTTP-friendly shapes for Express handlers.
 * @module utils/error-mapper
 */

const { TelemetryError } = require('./errors');
const { ERROR_CODES } = require('../config/error-codes');

/**
 * @typedef {object} MappedTelemetryError
 * @property {number} statusCode
 * @property {string} code
 * @property {string} message
 * @property {string[]} details
 */

/**
 * Client errors (4xx) thrown intentionally by the library.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
function isTelemetryClientError(err) {
  if (err instanceof TelemetryError) {
    return err.statusCode >= 400 && err.statusCode < 500;
  }
  if (err && typeof err === 'object' && err.isJoi) {
    return true;
  }
  return typeof err?.status === 'number' && err.status >= 400 && err.status < 500;
}

/**
 * @param {unknown} err
 * @returns {MappedTelemetryError|null}
 */
function mapTelemetryError(err) {
  if (err instanceof TelemetryError) {
    const details = err.details || [];
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      /** Prefer specific lines for UI when multiple validation issues exist */
      error: details.length > 0 ? details.join(' ') : err.message,
      details,
    };
  }

  if (err && typeof err === 'object' && err.isJoi) {
    return {
      statusCode: 400,
      code: ERROR_CODES.SEARCH_VALIDATION_ERROR,
      message: String(err.message || 'Invalid search request'),
      details: [],
    };
  }

  if (typeof err?.status === 'number' && err.message) {
    return {
      statusCode: err.status,
      code:
        err.status === 503 ? ERROR_CODES.QUERY_TIMEOUT : ERROR_CODES.GUARDRAIL_VIOLATION,
      message: String(err.message),
      details: [],
    };
  }

  return null;
}

module.exports = {
  mapTelemetryError,
  isTelemetryClientError,
};
