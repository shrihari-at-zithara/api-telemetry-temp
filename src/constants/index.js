/**
 * Re-exports domain constants and runtime limits (single import path for app code).
 * @module constants
 */

const { telemetryConfig } = require('../config/telemetry.config');
const {
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
} = require('../config/vars');

const { write } = telemetryConfig;

module.exports = {
  API_CALL_LOGS_TABLE,
  REQUIRED_LOG_FIELDS,
  HTTP_METHODS,
  SUGGESTED_PLATFORMS,
  SUGGESTED_API_PROVIDERS,
  UUID_REGEX,
  HTTP_STATUS_MIN,
  HTTP_STATUS_MAX,
  MAX_TEXT_FIELD_LENGTH: write.maxTextFieldLength,
  MAX_SNAPSHOT_BYTES: write.maxSnapshotBytes,
  MAX_JSON_DEPTH: write.maxJsonDepth,
  MAX_STACK_LENGTH: write.maxStackLength,
  SENSITIVE_HEADER_KEYS,
  SENSITIVE_FIELD_PATTERNS,
  telemetryConfig,
};
