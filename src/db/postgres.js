/**
 * PostgreSQL access via host-injected pool or query (set at initializeApiTelemetry).
 * @module db/postgres
 */

const { MESSAGES } = require('../config/messages');
const { ConfigurationError } = require('../utils/errors');

/** @type {import('pg').Pool | null} */
let externalPool = null;

/** @type {((text: string, params?: unknown[]) => Promise<import('pg').QueryResult>) | null} */
let externalQuery = null;

/**
 * @typedef {(callback: (client: { query: typeof query }) => Promise<unknown>) => Promise<unknown>} RunInTransactionFn
 */

/** @type {RunInTransactionFn | null} */
let externalRunInTransaction = null;

/**
 * Use the host service's existing pool (avoids duplicate connections).
 *
 * @param {import('pg').Pool} pool
 */
function setExternalPool(pool) {
  externalPool = pool;
  externalQuery = null;
  externalRunInTransaction = null;
}

/**
 * Use a host-provided query function (e.g. campaign-backend `db.query`).
 *
 * @param {(text: string, params?: unknown[]) => Promise<import('pg').QueryResult>} queryFn
 */
function setExternalQuery(queryFn) {
  externalQuery = queryFn;
  externalPool = null;
}

/**
 * Host-provided transaction runner (e.g. Sequelize `sequelize.transaction`).
 * Required for search when using `query` without a native `pg` Pool.
 *
 * @param {RunInTransactionFn} fn
 */
function setExternalRunInTransaction(fn) {
  externalRunInTransaction = fn;
}

/**
 * @returns {import('pg').Pool}
 */
function getPool() {
  if (!externalPool) {
    throw new ConfigurationError(MESSAGES.db.poolRequired());
  }

  return externalPool;
}

/**
 * @param {string} text
 * @param {unknown[]} [params]
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  if (externalQuery) {
    return externalQuery(text, params);
  }

  const pool = getPool();
  if (typeof pool.query === 'function') {
    return pool.query(text, params);
  }

  throw new ConfigurationError(MESSAGES.db.poolRequired());
}

/**
 * Runs callback inside a single DB transaction (same connection/session).
 *
 * @template T
 * @param {(client: { query: typeof query }) => Promise<T>} callback
 * @returns {Promise<T>}
 */
async function runInTransaction(callback) {
  if (externalRunInTransaction) {
    return externalRunInTransaction(callback);
  }

  const pool = getPool();
  if (typeof pool.connect !== 'function') {
    throw new ConfigurationError(MESSAGES.db.transactionRequired());
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  query,
  getPool,
  runInTransaction,
  setExternalPool,
  setExternalQuery,
  setExternalRunInTransaction,
};
