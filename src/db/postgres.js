/**
 * PostgreSQL access: optional host-injected pool/query, or lazy env-based pool.
 * @module db/postgres
 */

const { Pool } = require('pg');
const { getPoolConfig } = require('../config');
const { MESSAGES } = require('../config/messages');
const { ConfigurationError } = require('../utils/errors');
const logger = require('../utils/logger');

/** @type {import('pg').Pool | null} */
let ownedPool = null;

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
  if (externalPool) {
    return externalPool;
  }

  if (!ownedPool) {
    const config = getPoolConfig();

    if (!config.connectionString && !config.database) {
      throw new ConfigurationError(
        'PostgreSQL is not configured. Call initializeApiTelemetry({ pool }) or set DATABASE_URL / POSTGRES_URI / PGDATABASE.'
      );
    }

    ownedPool = new Pool(config);

    ownedPool.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client', {
        error: err.message,
      });
    });

    logger.debug('PostgreSQL pool initialized (library-owned)');
  }

  return ownedPool;
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

/**
 * Closes only the library-owned pool, never a host-injected pool.
 *
 * @returns {Promise<void>}
 */
async function closePool() {
  if (ownedPool) {
    await ownedPool.end();
    ownedPool = null;
    logger.debug('PostgreSQL pool closed');
  }
}

module.exports = {
  query,
  getPool,
  closePool,
  runInTransaction,
  setExternalPool,
  setExternalQuery,
  setExternalRunInTransaction,
};
