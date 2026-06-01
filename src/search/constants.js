/**
 * @deprecated Import from `config/telemetry.config` instead.
 * Re-exported for backward compatibility.
 * @module search/constants
 */

const { telemetryConfig, formatStatementTimeout, MS_PER_DAY } = require('../config/telemetry.config');

const { search } = telemetryConfig;

module.exports = {
  DEFAULT_LIMIT: search.defaultLimit,
  MAX_LIMIT: search.maxLimit,
  MAX_RANGE_DAYS: search.maxRangeDays,
  MAX_TOTAL_COUNT_RANGE_DAYS: search.maxTotalCountRangeDays,
  MAX_SNAPSHOT_LIMIT: search.maxSnapshotLimit,
  DEFAULT_QUERY_TIMEOUT_MS: search.queryTimeoutMs,
  QUERY_TIMEOUT_MS: search.queryTimeoutMs,
  STATEMENT_TIMEOUT: search.statementTimeout,
  MS_PER_DAY,
  formatStatementTimeout,
};
