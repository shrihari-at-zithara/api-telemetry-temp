/**
 * Runtime bootstrap — host services inject DB access (same pattern as lead-scoring-lib).
 * @module runtime/initialize
 */

const {
  setExternalPool,
  setExternalQuery,
  setExternalRunInTransaction,
} = require('../db/postgres');
const { logApiCall } = require('../services/api-call-log.service');
const { searchApiCallLogs } = require('../search/service');
const { MESSAGES } = require('../config/messages');
const { ConfigurationError } = require('../utils/errors');

let initialized = false;

/**
 * @param {string} name
 * @param {unknown} value
 * @returns {unknown}
 */
const ensureDependency = (name, value) => {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

/**
 * Wire the library to the host application's database layer.
 *
 * Provide **one** of:
 * - `pool` — native `pg` Pool with `.connect()` (campaign-backend style)
 * - `query` + `runInTransaction` — host SQL wrapper (Sequelize / admin-panel style)
 *
 * If neither is provided, the library lazily creates its own pool from env on first use.
 *
 * @param {object} [options]
 * @param {import('pg').Pool} [options.pool]
 * @param {(text: string, params?: unknown[]) => Promise<import('pg').QueryResult>} [options.query]
 * @param {(callback: (client: { query: typeof options.query }) => Promise<unknown>) => Promise<unknown>} [options.runInTransaction]
 * @returns {{ logApiCall: typeof logApiCall, searchApiCallLogs: typeof searchApiCallLogs }}
 */
const initializeApiTelemetry = (options = {}) => {
  const { pool, query, runInTransaction } = options;

  if (pool && query) {
    throw new ConfigurationError(MESSAGES.db.initPoolOrQuery());
  }

  if (pool) {
    if (typeof pool.connect !== 'function') {
      throw new ConfigurationError(MESSAGES.db.poolConnectRequired());
    }
    setExternalPool(ensureDependency('pool', pool));
  } else if (query) {
    setExternalQuery(ensureDependency('query', query));
    if (runInTransaction) {
      setExternalRunInTransaction(ensureDependency('runInTransaction', runInTransaction));
    }
  }

  initialized = true;

  return { logApiCall, searchApiCallLogs };
};

/**
 * @returns {boolean}
 */
const isApiTelemetryInitialized = () => initialized;

module.exports = {
  initializeApiTelemetry,
  isApiTelemetryInitialized,
};
