/**
 * Central limits and tunables for api-telemetry-lib.
 *
 * Change {@link TELEMETRY_DEFAULTS} to adjust library behavior.
 * Optional environment variables override values at process startup (see .env.example).
 *
 * @module config/telemetry.config
 */

const { parsePositiveIntEnv } = require('../utils/parse-env');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Default limits (code). Env vars can override without editing this file.
 * @type {Readonly<{
 *   search: {
 *     defaultLimit: number,
 *     maxLimit: number,
 *     maxRangeDays: number,
 *     maxTotalCountRangeDays: number,
 *     maxSnapshotLimit: number,
 *     queryTimeoutMs: number,
 *   },
 *   write: {
 *     maxTextFieldLength: number,
 *     maxSnapshotBytes: number,
 *     maxJsonDepth: number,
 *     maxStackLength: number,
 *   },
 * }>}
 */
const TELEMETRY_DEFAULTS = Object.freeze({
  search: {
    defaultLimit: 50,
    maxLimit: 100,
    maxRangeDays: 31,
    maxTotalCountRangeDays: 7,
    maxSnapshotLimit: 25,
    queryTimeoutMs: 10000,
  },
  write: {
    maxTextFieldLength: 2048,
    maxSnapshotBytes: 128 * 1024,
    maxJsonDepth: 12,
    maxStackLength: 4096,
  },
});

/**
 * @param {number} ms
 * @returns {string} PostgreSQL statement_timeout value
 */
function formatStatementTimeout(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms % 1000 === 0) {
    return `${ms / 1000}s`;
  }
  return `${ms}ms`;
}

/**
 * @returns {import('./telemetry.config').TelemetryConfig}
 */
function loadTelemetryConfig() {
  const queryTimeoutMs = parsePositiveIntEnv(
    'API_CALL_LOG_QUERY_TIMEOUT_MS',
    TELEMETRY_DEFAULTS.search.queryTimeoutMs
  );

  const search = Object.freeze({
    defaultLimit: parsePositiveIntEnv(
      'API_TELEMETRY_SEARCH_DEFAULT_LIMIT',
      TELEMETRY_DEFAULTS.search.defaultLimit
    ),
    maxLimit: parsePositiveIntEnv(
      'API_TELEMETRY_SEARCH_MAX_LIMIT',
      TELEMETRY_DEFAULTS.search.maxLimit
    ),
    maxRangeDays: parsePositiveIntEnv(
      'API_TELEMETRY_SEARCH_MAX_RANGE_DAYS',
      TELEMETRY_DEFAULTS.search.maxRangeDays
    ),
    maxTotalCountRangeDays: parsePositiveIntEnv(
      'API_TELEMETRY_SEARCH_MAX_TOTAL_RANGE_DAYS',
      TELEMETRY_DEFAULTS.search.maxTotalCountRangeDays
    ),
    maxSnapshotLimit: parsePositiveIntEnv(
      'API_TELEMETRY_SEARCH_MAX_SNAPSHOT_LIMIT',
      TELEMETRY_DEFAULTS.search.maxSnapshotLimit
    ),
    queryTimeoutMs,
    statementTimeout: formatStatementTimeout(queryTimeoutMs),
  });

  const write = Object.freeze({ ...TELEMETRY_DEFAULTS.write });

  return Object.freeze({
    search,
    write,
    msPerDay: MS_PER_DAY,
  });
}

/** @typedef {{ search: object, write: object, msPerDay: number }} TelemetryConfig */

const telemetryConfig = loadTelemetryConfig();

module.exports = {
  telemetryConfig,
  TELEMETRY_DEFAULTS,
  loadTelemetryConfig,
  formatStatementTimeout,
  MS_PER_DAY,
};
