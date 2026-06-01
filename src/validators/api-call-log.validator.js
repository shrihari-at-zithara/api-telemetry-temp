/**
 * Lightweight payload validation for API call logs.
 * @module validators/api-call-log
 */

const {
  HTTP_METHODS,
  UUID_REGEX,
  HTTP_STATUS_MIN,
  HTTP_STATUS_MAX,
  MAX_TEXT_FIELD_LENGTH,
} = require('../constants');
const { ValidationError } = require('../utils/errors');
const { prepareSnapshotForStorage } = require('../utils/snapshot-sanitizer');
const {
  buildRequestSnapshot,
  buildResponseSnapshotFromSuccess,
  buildResponseSnapshotFromError,
} = require('../utils/http-snapshot');

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} value
 * @param {number} maxLength
 * @returns {boolean}
 */
function isBoundedString(value, maxLength = MAX_TEXT_FIELD_LENGTH) {
  return isNonEmptyString(value) && value.trim().length <= maxLength;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidBoolean(value) {
  return typeof value === 'boolean';
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidHttpStatus(value) {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= HTTP_STATUS_MIN &&
    value <= HTTP_STATUS_MAX
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidResponseTime(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Matches `users.id` (BIGINT, positive integer).
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidUserId(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidRequestedAt(value) {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }
  if (typeof value === 'string') {
    return !Number.isNaN(Date.parse(value));
  }
  return false;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isOptionalSnapshotSource(value) {
  if (value === undefined || value === null) {
    return true;
  }

  return isPlainObject(value);
}

/**
 * Validates raw input and returns a list of field errors (empty when valid).
 *
 * @param {unknown} payload
 * @returns {string[]}
 */
function collectValidationErrors(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    return ['payload must be a non-null object'];
  }

  if (payload.merchant_id === null || payload.merchant_id === undefined) {
    errors.push('merchant_id is required and cannot be null');
  } else if (!isValidUuid(payload.merchant_id)) {
    errors.push('merchant_id must be a valid UUID');
  }

  if (payload.user_id !== undefined && payload.user_id !== null) {
    if (!isValidUserId(payload.user_id)) {
      errors.push('user_id must be a positive integer when provided');
    }
  }

  if (payload.instagram_page_id !== undefined && payload.instagram_page_id !== null) {
    if (!isNonEmptyString(payload.instagram_page_id)) {
      errors.push('instagram_page_id must be a non-empty string when provided');
    }
  }

  if (!isBoundedString(payload.platform)) {
    errors.push(
      `platform is required and must be a non-empty string (max ${MAX_TEXT_FIELD_LENGTH} chars)`
    );
  }

  if (!isBoundedString(payload.api_provider)) {
    errors.push(
      `api_provider is required and must be a non-empty string (max ${MAX_TEXT_FIELD_LENGTH} chars)`
    );
  }

  if (payload.endpoint === null || payload.endpoint === undefined) {
    errors.push('endpoint is required and cannot be null');
  } else if (!isBoundedString(payload.endpoint)) {
    errors.push(`endpoint must be a non-empty string (max ${MAX_TEXT_FIELD_LENGTH} chars)`);
  }

  if (payload.endpoint_group !== undefined && payload.endpoint_group !== null) {
    if (!isNonEmptyString(payload.endpoint_group)) {
      errors.push('endpoint_group must be a non-empty string when provided');
    }
  }

  if (payload.http_method === null || payload.http_method === undefined) {
    errors.push('http_method is required and cannot be null');
  } else if (!isNonEmptyString(payload.http_method)) {
    errors.push('http_method must be a non-empty string');
  } else if (!HTTP_METHODS.includes(payload.http_method.trim().toUpperCase())) {
    errors.push(`http_method must be one of: ${HTTP_METHODS.join(', ')}`);
  }

  if (!isValidBoolean(payload.success)) {
    errors.push('success is required and must be a boolean');
  }

  if (payload.http_status !== undefined && payload.http_status !== null) {
    if (!isValidHttpStatus(payload.http_status)) {
      errors.push(
        `http_status must be an integer between ${HTTP_STATUS_MIN} and ${HTTP_STATUS_MAX}`
      );
    }
  }

  if (payload.response_time_ms === null || payload.response_time_ms === undefined) {
    errors.push('response_time_ms is required and cannot be null');
  } else if (!isValidResponseTime(payload.response_time_ms)) {
    errors.push('response_time_ms must be a non-negative integer');
  }

  if (payload.error_code !== undefined && payload.error_code !== null) {
    if (!isNonEmptyString(payload.error_code)) {
      errors.push('error_code must be a non-empty string when provided');
    }
  }

  if (payload.error_message !== undefined && payload.error_message !== null) {
    if (!isNonEmptyString(payload.error_message)) {
      errors.push('error_message must be a non-empty string when provided');
    }
  }

  if (payload.request_id !== undefined && payload.request_id !== null) {
    if (!isNonEmptyString(payload.request_id)) {
      errors.push('request_id must be a non-empty string when provided');
    }
  }

  if (payload.trace_id !== undefined && payload.trace_id !== null) {
    if (!isValidUuid(payload.trace_id)) {
      errors.push('trace_id must be a valid UUID when provided');
    }
  }

  if (payload.requested_at !== undefined && payload.requested_at !== null) {
    if (!isValidRequestedAt(payload.requested_at)) {
      errors.push('requested_at must be a valid Date or ISO-8601 string when provided');
    }
  }

  if (!isOptionalSnapshotSource(payload.request)) {
    errors.push('request must be a plain object when provided');
  }

  if (!isOptionalSnapshotSource(payload.request_snapshot)) {
    errors.push('request_snapshot must be a plain object when provided');
  }

  if (!isOptionalSnapshotSource(payload.response)) {
    errors.push('response must be a plain object when provided');
  }

  if (!isOptionalSnapshotSource(payload.response_snapshot)) {
    errors.push('response_snapshot must be a plain object when provided');
  }

  return errors;
}

/**
 * @param {import('../types/api-call-log.type').ApiCallLogInput} payload
 * @returns {object|null}
 */
function resolveRequestSnapshot(payload) {
  if (payload.request_snapshot !== undefined && payload.request_snapshot !== null) {
    return prepareSnapshotForStorage(payload.request_snapshot);
  }

  if (payload.request !== undefined && payload.request !== null) {
    return buildRequestSnapshot(payload.request);
  }

  return null;
}

/**
 * @param {import('../types/api-call-log.type').ApiCallLogInput} payload
 * @returns {object|null}
 */
function resolveResponseSnapshot(payload) {
  if (payload.response_snapshot !== undefined && payload.response_snapshot !== null) {
    return prepareSnapshotForStorage(payload.response_snapshot);
  }

  if (payload.success) {
    if (payload.response !== undefined && payload.response !== null) {
      return buildResponseSnapshotFromSuccess(payload.response);
    }
    return null;
  }

  if (payload.error !== undefined && payload.error !== null) {
    return buildResponseSnapshotFromError(payload.error);
  }

  if (payload.response !== undefined && payload.response !== null) {
    return buildResponseSnapshotFromError({
      message: payload.error_message || 'Request failed',
      response: payload.response,
    });
  }

  return null;
}

/**
 * Validates payload and throws {@link ValidationError} when invalid.
 *
 * @param {unknown} payload
 * @throws {ValidationError}
 */
function assertValidApiCallLog(payload) {
  const errors = collectValidationErrors(payload);
  if (errors.length > 0) {
    throw new ValidationError('Invalid API call log payload', errors);
  }
}

/**
 * Normalizes a validated payload into a persistence-ready record.
 *
 * @param {import('../types/api-call-log.type').ApiCallLogInput} payload
 * @returns {import('../types/api-call-log.type').ApiCallLogRecord}
 */
function normalizeApiCallLog(payload) {
  return {
    merchant_id: payload.merchant_id.trim(),
    user_id: payload.user_id === undefined || payload.user_id === null ? null : payload.user_id,
    instagram_page_id: payload.instagram_page_id ? payload.instagram_page_id.trim() : null,
    platform: payload.platform.trim().toLowerCase(),
    api_provider: payload.api_provider.trim().toLowerCase(),
    endpoint: payload.endpoint.trim(),
    endpoint_group: payload.endpoint_group ? payload.endpoint_group.trim() : null,
    http_method: payload.http_method.trim().toUpperCase(),
    http_status:
      payload.http_status === undefined || payload.http_status === null
        ? null
        : payload.http_status,
    success: payload.success,
    response_time_ms: payload.response_time_ms,
    error_code: payload.error_code ? payload.error_code.trim() : null,
    error_message: payload.error_message ? payload.error_message.trim() : null,
    request_id: payload.request_id ? payload.request_id.trim() : null,
    trace_id: payload.trace_id ? payload.trace_id.trim() : null,
    request_snapshot: resolveRequestSnapshot(payload),
    response_snapshot: resolveResponseSnapshot(payload),
    requested_at: payload.requested_at
      ? payload.requested_at instanceof Date
        ? payload.requested_at
        : new Date(payload.requested_at)
      : null,
  };
}

module.exports = {
  collectValidationErrors,
  assertValidApiCallLog,
  normalizeApiCallLog,
};
