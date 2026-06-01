/**
 * Environment-driven configuration for database and runtime behavior.
 * @module config
 */

const { parsePositiveInt } = require('../utils/parse-env');

/**
 * @returns {import('pg').PoolConfig}
 */
function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;

  if (connectionString) {
    return {
      connectionString,
      max: parsePositiveInt(process.env.PG_POOL_MAX, 10),
      idleTimeoutMillis: parsePositiveInt(process.env.PG_POOL_IDLE_TIMEOUT_MS, 30000),
      connectionTimeoutMillis: parsePositiveInt(process.env.PG_POOL_CONNECTION_TIMEOUT_MS, 5000),
    };
  }

  return {
    host: process.env.PGHOST || 'localhost',
    port: parsePositiveInt(process.env.PGPORT, 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    max: parsePositiveInt(process.env.PG_POOL_MAX, 10),
    idleTimeoutMillis: parsePositiveInt(process.env.PG_POOL_IDLE_TIMEOUT_MS, 30000),
    connectionTimeoutMillis: parsePositiveInt(process.env.PG_POOL_CONNECTION_TIMEOUT_MS, 5000),
  };
}

module.exports = {
  getPoolConfig,
  logLevel: (process.env.API_TELEMETRY_LOG_LEVEL || 'info').toLowerCase(),
};
