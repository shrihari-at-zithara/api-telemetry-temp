/**
 * Data access layer for api_call_logs (SQL only).
 * @module repositories/api-call-log
 */

const { query } = require('../db/postgres');
const { API_CALL_LOGS_TABLE } = require('../config/vars');
const { MESSAGES } = require('../config/messages');
const { DatabaseError } = require('../utils/errors');

const INSERT_SQL = `
  INSERT INTO ${API_CALL_LOGS_TABLE} (
    merchant_id,
    user_id,
    instagram_page_id,
    platform,
    api_provider,
    endpoint,
    endpoint_group,
    http_method,
    http_status,
    success,
    response_time_ms,
    error_code,
    error_message,
    request_id,
    trace_id,
    request_snapshot,
    response_snapshot,
    requested_at
  )
  VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
    COALESCE($18, NOW())
  )
  RETURNING id, requested_at
`;

/**
 * Persists one API call log row.
 *
 * @param {import('../types/api-call-log.type').ApiCallLogRecord} record
 * @returns {Promise<import('../types/api-call-log.type').ApiCallLogResult>}
 */
async function insertApiCallLog(record) {
  const params = [
    record.merchant_id,
    record.user_id,
    record.instagram_page_id,
    record.platform,
    record.api_provider,
    record.endpoint,
    record.endpoint_group,
    record.http_method,
    record.http_status,
    record.success,
    record.response_time_ms,
    record.error_code,
    record.error_message,
    record.request_id,
    record.trace_id,
    record.request_snapshot,
    record.response_snapshot,
    record.requested_at,
  ];

  try {
    const result = await query(INSERT_SQL, params);
    const row = result.rows[0];

    return {
      id: row.id,
      requested_at: row.requested_at,
    };
  } catch (err) {
    throw new DatabaseError(MESSAGES.db.insertFailed(), err);
  }
}

module.exports = {
  insertApiCallLog,
};
