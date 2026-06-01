/**
 * Business guardrails for api_call_logs search (beyond Joi schema).
 * @module search/guardrails
 */

const { telemetryConfig } = require('../config/telemetry.config');
const { MESSAGES } = require('../config/messages');
const { GuardrailError } = require('../utils/errors');
const { getRangeSpanDays } = require('./date-range');

const { search: searchLimits } = telemetryConfig;

/**
 * @param {object} params
 * @param {{ from: Date, to: Date }} params.requestedAtRange
 * @param {number} params.limit
 * @param {boolean} params.includeTotal
 * @param {boolean} params.includeSnapshots
 */
function enforceQueryGuardrails({
  requestedAtRange,
  limit,
  includeTotal,
  includeSnapshots,
}) {
  if (includeTotal) {
    const rangeDays = getRangeSpanDays(requestedAtRange);
    if (rangeDays > searchLimits.maxTotalCountRangeDays) {
      throw new GuardrailError(MESSAGES.search.includeTotalRangeExceeded());
    }
  }

  if (includeSnapshots && limit > searchLimits.maxSnapshotLimit) {
    throw new GuardrailError(MESSAGES.search.snapshotLimitExceeded());
  }
}

module.exports = {
  enforceQueryGuardrails,
};
