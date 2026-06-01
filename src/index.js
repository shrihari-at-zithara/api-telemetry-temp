/**
 * @zithara/api-telemetry-lib
 *
 * Reusable telemetry utilities for Node.js backend services.
 * Primary capability: persist outbound API call metadata to PostgreSQL.
 *
 * @module @zithara/api-telemetry-lib
 */

const { logApiCall } = require('./services/api-call-log.service');
const { searchApiCallLogs } = require('./search/service');
const { validateSearchPayload } = require('./search/validate-payload');
const { initializeApiTelemetry } = require('./runtime/initialize');
const {
  buildRequestSnapshot,
  buildResponseSnapshot,
  buildResponseSnapshotFromSuccess,
  buildResponseSnapshotFromError,
  buildRequestSnapshotFromAxiosConfig,
} = require('./utils/http-snapshot');
const {
  TelemetryError,
  ValidationError,
  SearchValidationError,
  GuardrailError,
  DatabaseError,
  QueryTimeoutError,
  ConfigurationError,
} = require('./utils/errors');
const { mapTelemetryError, isTelemetryClientError } = require('./utils/error-mapper');
const { telemetryConfig, TELEMETRY_DEFAULTS, loadTelemetryConfig } = require('./config/telemetry.config');
const { ERROR_CODES, HTTP_STATUS } = require('./config/error-codes');

module.exports = {
  logApiCall,
  searchApiCallLogs,
  validateSearchPayload,
  initializeApiTelemetry,
  buildRequestSnapshot,
  buildResponseSnapshot,
  buildResponseSnapshotFromSuccess,
  buildResponseSnapshotFromError,
  buildRequestSnapshotFromAxiosConfig,
  TelemetryError,
  ValidationError,
  SearchValidationError,
  GuardrailError,
  DatabaseError,
  QueryTimeoutError,
  ConfigurationError,
  mapTelemetryError,
  isTelemetryClientError,
  telemetryConfig,
  TELEMETRY_DEFAULTS,
  loadTelemetryConfig,
  ERROR_CODES,
  HTTP_STATUS,
};
