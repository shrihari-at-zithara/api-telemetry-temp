/**
 * Typed errors for predictable handling in consuming services.
 * @module utils/errors
 */

const { ERROR_CODES, HTTP_STATUS } = require('../config/error-codes');

/**
 * Base error for api-telemetry-lib failures.
 */
class TelemetryError extends Error {
  /**
   * @param {string} message
   * @param {object} [options]
   * @param {string} [options.code]
   * @param {number} [options.statusCode]
   * @param {string[]} [options.details]
   * @param {unknown} [options.cause]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'TelemetryError';
    this.code = options.code || ERROR_CODES.TELEMETRY_ERROR;
    this.statusCode = options.statusCode ?? HTTP_STATUS.INTERNAL_SERVER_ERROR;
    this.details = options.details || [];
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  /**
   * @param {unknown} err
   * @returns {boolean}
   */
  static isTelemetryError(err) {
    return err instanceof TelemetryError;
  }
}

/**
 * Thrown when an API call log payload fails validation (write path).
 */
class ValidationError extends TelemetryError {
  /**
   * @param {string} message
   * @param {string[]} [details]
   */
  constructor(message, details = []) {
    super(message, {
      code: ERROR_CODES.VALIDATION_ERROR,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      details,
    });
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when a search request body fails Joi validation.
 */
class SearchValidationError extends TelemetryError {
  /**
   * @param {string} message
   * @param {string[]} [details]
   */
  constructor(message, details = []) {
    super(message, {
      code: ERROR_CODES.SEARCH_VALIDATION_ERROR,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      details,
    });
    this.name = 'SearchValidationError';
    /** @deprecated Use instanceof SearchValidationError or code === SEARCH_VALIDATION_ERROR */
    this.isJoi = true;
  }
}

/**
 * Thrown when a valid search payload violates business guardrails (date span, limits).
 */
class GuardrailError extends TelemetryError {
  /**
   * @param {string} message
   * @param {string[]} [details]
   */
  constructor(message, details = []) {
    super(message, {
      code: ERROR_CODES.GUARDRAIL_VIOLATION,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      details,
    });
    this.name = 'GuardrailError';
  }
}

/**
 * Thrown when PostgreSQL insert/select fails.
 */
class DatabaseError extends TelemetryError {
  /**
   * @param {string} message
   * @param {unknown} [cause]
   */
  constructor(message, cause) {
    super(message, {
      code: ERROR_CODES.DATABASE_ERROR,
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      cause,
    });
    this.name = 'DatabaseError';
  }
}

/**
 * Thrown when a search query exceeds statement_timeout.
 */
class QueryTimeoutError extends TelemetryError {
  constructor() {
    const { MESSAGES } = require('../config/messages');
    super(MESSAGES.search.queryTimedOut(), {
      code: ERROR_CODES.QUERY_TIMEOUT,
      statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
    });
    this.name = 'QueryTimeoutError';
  }
}

/**
 * Thrown when bootstrap or runtime configuration is invalid.
 */
class ConfigurationError extends TelemetryError {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message, {
      code: ERROR_CODES.CONFIGURATION_ERROR,
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    });
    this.name = 'ConfigurationError';
  }
}

module.exports = {
  TelemetryError,
  ValidationError,
  SearchValidationError,
  GuardrailError,
  DatabaseError,
  QueryTimeoutError,
  ConfigurationError,
};
