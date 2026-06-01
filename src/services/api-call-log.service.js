/**
 * Business logic for recording API call telemetry.
 * @module services/api-call-log
 */

const apiCallLogRepository = require('../repositories/api-call-log.repository');
const {
  assertValidApiCallLog,
  normalizeApiCallLog,
} = require('../validators/api-call-log.validator');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Validates, normalizes, and persists an API call log entry.
 *
 * @param {import('../types/api-call-log.type').ApiCallLogInput} payload
 * @returns {Promise<import('../types/api-call-log.type').ApiCallLogResult>}
 * @throws {ValidationError} When the payload is invalid.
 * @throws {import('../utils/errors').DatabaseError} When persistence fails.
 */
async function logApiCall(payload) {
  try {
    assertValidApiCallLog(payload);
    const record = normalizeApiCallLog(payload);
    const result = await apiCallLogRepository.insertApiCallLog(record);

    logger.debug('API call log recorded', {
      id: result.id,
      merchant_id: record.merchant_id,
      platform: record.platform,
      endpoint: record.endpoint,
      success: record.success,
    });

    return result;
  } catch (err) {
    if (err instanceof ValidationError) {
      logger.warn('API call log validation failed', { details: err.details });
      throw err;
    }

    logger.error('API call log persistence failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

module.exports = {
  logApiCall,
};
