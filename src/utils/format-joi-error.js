/**
 * Converts Joi validation details into short, UI-friendly messages.
 * @module utils/format-joi-error
 */

const { MESSAGES } = require('../config/messages');
const { labelForPath } = require('../config/field-labels');
const { telemetryConfig } = require('../config/telemetry.config');

/**
 * @param {import('joi').ValidationError} joiError
 * @returns {{ message: string, details: string[] }}
 */
function formatJoiValidationError(joiError) {
  const details = (joiError.details || []).map(formatJoiDetail);
  const unique = [...new Set(details.filter(Boolean))];

  const message =
    unique.length === 1
      ? unique[0]
      : unique.length > 1
        ? MESSAGES.search.validationSummary(unique.length)
        : 'Invalid search request.';

  return { message, details: unique };
}

/**
 * @param {import('joi').ValidationErrorItem} detail
 * @returns {string}
 */
function formatJoiDetail(detail) {
  const path = detail.path || [];
  const pathKey = path.map(String).join('.');
  const label = labelForPath(path);
  const ctx = detail.context || {};
  const { search: searchLimits } = telemetryConfig;

  switch (detail.type) {
    case 'object.unknown':
      if (path[0] === 'filters' && path.length > 1) {
        return MESSAGES.search.unknownFilterKey(String(path[path.length - 1]));
      }
      return MESSAGES.search.unknownTopLevelKey(String(path[path.length - 1] || ctx.label || 'field'));

    case 'object.missing':
      if (pathKey.includes('requested_at') || path.includes('requested_at')) {
        return MESSAGES.search.requestedAtRequired();
      }
      return `${label} is required.`;

    case 'number.max':
      if (pathKey.endsWith('http_status')) {
        return MESSAGES.search.httpStatusRange();
      }
      if (pathKey.endsWith('limit')) {
        return MESSAGES.search.pageSizeMax(ctx.limit ?? searchLimits.maxLimit);
      }
      return `${label} must be at most ${ctx.limit}.`;

    case 'number.min':
      if (pathKey.endsWith('http_status')) {
        return MESSAGES.search.httpStatusRange();
      }
      if (pathKey.endsWith('limit')) {
        return MESSAGES.search.pageSizeMin();
      }
      return `${label} must be at least ${ctx.limit}.`;

    case 'number.base':
    case 'number.integer':
      if (pathKey.endsWith('http_status')) {
        return MESSAGES.search.httpStatusInvalid();
      }
      return `${label} must be a number.`;

    case 'string.guid':
    case 'string.uuid':
      if (pathKey.includes('merchant_id')) {
        return MESSAGES.search.merchantIdInvalid();
      }
      return MESSAGES.search.invalidUuid(label);

    case 'string.pattern.base':
      if (pathKey.includes('date_from') || pathKey.includes('date_to')) {
        return 'Use dates in YYYY-MM-DD format.';
      }
      if (pathKey.includes('time_from') || pathKey.includes('time_to')) {
        return 'Use times in HH:mm format.';
      }
      return `${label} has an invalid format.`;

    case 'date.format':
    case 'date.base':
      return MESSAGES.search.invalidDate(label);

    case 'any.only':
    case 'any.invalid':
      if (pathKey.endsWith('http_method')) {
        return MESSAGES.search.httpMethodInvalid();
      }
      if (pathKey.endsWith('sort.order')) {
        return 'Sort order must be ascending or descending.';
      }
      return `${label} has an invalid value.`;

    case 'array.min':
      if (pathKey === 'select_fields') {
        return MESSAGES.search.emptySelectFields();
      }
      return `Select at least one value for ${label}.`;

    case 'array.unique':
      if (pathKey === 'select_fields') {
        return MESSAGES.search.duplicateSelectFields();
      }
      return `${label} contains duplicate values.`;

    case 'any.custom':
      if (detail.message && !detail.message.startsWith('"')) {
        return detail.message;
      }
      break;

    case 'boolean.base':
      return MESSAGES.search.invalidBoolean(label);

    case 'string.empty':
    case 'string.min':
      return MESSAGES.search.emptyString(label);

    case 'alternatives.match':
      if (pathKey.endsWith('http_status')) {
        return MESSAGES.search.httpStatusRange();
      }
      if (pathKey.endsWith('http_method')) {
        return MESSAGES.search.httpMethodInvalid();
      }
      break;

    default:
      break;
  }

  if (pathKey.endsWith('http_status')) {
    if (/less than or equal to 599|greater than or equal to 100/i.test(detail.message)) {
      return MESSAGES.search.httpStatusRange();
    }
  }

  return sanitizeRawJoiMessage(detail.message, pathKey);
}

/**
 * Fallback: strip Joi path prefixes and quoted keys from default messages.
 *
 * @param {string} raw
 * @param {string} pathKey
 * @returns {string}
 */
function sanitizeRawJoiMessage(raw, pathKey) {
  if (!raw || typeof raw !== 'string') {
    return 'Invalid search request.';
  }

  let text = raw.replace(/^"[^"]+"\s*/i, '');

  if (pathKey.endsWith('http_status')) {
    return MESSAGES.search.httpStatusRange();
  }

  if (/is not allowed/i.test(text) && pathKey.startsWith('filters.')) {
    const key = pathKey.split('.').pop();
    return MESSAGES.search.unknownFilterKey(key);
  }

  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (!text.endsWith('.')) {
    text += '.';
  }
  return text;
}

module.exports = {
  formatJoiValidationError,
  formatJoiDetail,
};
