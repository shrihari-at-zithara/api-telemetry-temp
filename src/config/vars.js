/**
 * Domain constants (no environment reads). Mirrors lead-scoring-lib `config/vars.js`.
 * @module config/vars
 */

const API_CALL_LOGS_TABLE = 'api_call_logs';

/** Fields that must be present and non-null on every logApiCall payload. */
const REQUIRED_LOG_FIELDS = Object.freeze([
  'merchant_id',
  'endpoint',
  'http_method',
  'response_time_ms',
]);

const HTTP_METHODS = Object.freeze(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/**
 * Channel / product surface (where the call originated).
 * Not enforced at validation time — any non-empty string is accepted.
 */
const SUGGESTED_PLATFORMS = Object.freeze([
  'instagram',
  'facebook',
  'whatsapp',
  'internal',
]);

/**
 * Third-party or internal API vendor (who hosts the HTTP API).
 * Use `meta` here for Meta Graph API calls to Instagram/Facebook/WhatsApp — not as `platform`.
 * Not enforced at validation time.
 */
const SUGGESTED_API_PROVIDERS = Object.freeze(['meta', 'zithara']);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HTTP_STATUS_MIN = 100;
const HTTP_STATUS_MAX = 599;

/** Header names redacted to [REDACTED] (case-insensitive). */
const SENSITIVE_HEADER_KEYS = Object.freeze([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-access-token',
  'proxy-authorization',
]);

/** Body/query key substrings that trigger redaction (case-insensitive). */
const SENSITIVE_FIELD_PATTERNS = Object.freeze([
  'password',
  'token',
  'secret',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'authorization',
  'client_secret',
]);

module.exports = {
  API_CALL_LOGS_TABLE,
  REQUIRED_LOG_FIELDS,
  HTTP_METHODS,
  SUGGESTED_PLATFORMS,
  SUGGESTED_API_PROVIDERS,
  UUID_REGEX,
  HTTP_STATUS_MIN,
  HTTP_STATUS_MAX,
  SENSITIVE_HEADER_KEYS,
  SENSITIVE_FIELD_PATTERNS,
};
