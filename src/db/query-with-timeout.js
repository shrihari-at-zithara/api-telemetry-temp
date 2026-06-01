/**
 * Runs PostgreSQL queries inside a transaction with SET LOCAL statement_timeout.
 * @module db/query-with-timeout
 */

const { runInTransaction } = require('./postgres');
const { telemetryConfig } = require('../config/telemetry.config');
const { QueryTimeoutError } = require('../utils/errors');

const PG_QUERY_CANCELED = '57014';

/**
 * @param {Error} err
 * @returns {boolean}
 */
function isStatementTimeoutError(err) {
  if (err?.code === PG_QUERY_CANCELED) {
    return true;
  }
  const message = String(err?.message || '');
  return message.toLowerCase().includes('statement timeout');
}

/**
 * @param {Error} err
 * @returns {never}
 */
function rethrowQueryError(err) {
  if (isStatementTimeoutError(err)) {
    throw new QueryTimeoutError();
  }
  throw err;
}

/**
 * @template T
 * @param {(client: { query: Function }) => Promise<T>} callback
 * @returns {Promise<T>}
 */
async function withStatementTimeout(callback) {
  const { statementTimeout } = telemetryConfig.search;

  try {
    return await runInTransaction(async (client) => {
      await client.query(`SET LOCAL statement_timeout = '${statementTimeout}'`);
      return callback(client);
    });
  } catch (err) {
    rethrowQueryError(err);
  }
}

module.exports = {
  withStatementTimeout,
  isStatementTimeoutError,
  rethrowQueryError,
};
