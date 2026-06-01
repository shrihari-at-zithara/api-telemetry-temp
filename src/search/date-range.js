/**
 * requested_at range resolution and span helpers.
 * @module search/date-range
 */

const { telemetryConfig } = require('../config/telemetry.config');
const { MESSAGES } = require('../config/messages');
const { GuardrailError } = require('../utils/errors');

const { search: searchLimits, msPerDay } = telemetryConfig;

/**
 * @param {string} time
 * @returns {string}
 */
const normalizeTimeSegment = (time) => (time.length === 5 ? `${time}:00` : time);

/**
 * @param {string} date
 * @param {string} [time]
 * @returns {Date}
 */
function combineDateAndTime(date, time = '00:00:00') {
  const normalizedTime = normalizeTimeSegment(time);
  return new Date(`${date}T${normalizedTime}.000Z`);
}

/**
 * @param {object} requestedAtFilter
 * @returns {{ from: Date, to: Date }}
 */
function resolveRequestedAtRange(requestedAtFilter) {
  let from;
  let to;

  if (requestedAtFilter.from) {
    from = new Date(requestedAtFilter.from);
  } else if (requestedAtFilter.date_from) {
    from = combineDateAndTime(
      requestedAtFilter.date_from,
      requestedAtFilter.time_from || '00:00:00'
    );
  }

  if (requestedAtFilter.to) {
    to = new Date(requestedAtFilter.to);
  } else if (requestedAtFilter.date_to) {
    if (requestedAtFilter.time_to) {
      to = combineDateAndTime(requestedAtFilter.date_to, requestedAtFilter.time_to);
    } else {
      to = combineDateAndTime(requestedAtFilter.date_to, '00:00:00');
      to.setUTCDate(to.getUTCDate() + 1);
    }
  }

  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new GuardrailError(MESSAGES.search.requestedAtInvalid());
  }

  if (from >= to) {
    throw new GuardrailError(MESSAGES.search.requestedAtOrder());
  }

  assertWithinMaxRangeDays(from, to);

  return { from, to };
}

/**
 * @param {Date} from
 * @param {Date} to
 */
function assertWithinMaxRangeDays(from, to) {
  const rangeMs = to.getTime() - from.getTime();
  if (rangeMs > searchLimits.maxRangeDays * msPerDay) {
    throw new GuardrailError(MESSAGES.search.requestedAtRangeExceeded());
  }
}

/**
 * @param {{ from: Date, to: Date }} range
 * @returns {number}
 */
function getRangeSpanMs(range) {
  return range.to.getTime() - range.from.getTime();
}

/**
 * @param {{ from: Date, to: Date }} range
 * @returns {number}
 */
function getRangeSpanDays(range) {
  return getRangeSpanMs(range) / msPerDay;
}

module.exports = {
  resolveRequestedAtRange,
  assertWithinMaxRangeDays,
  getRangeSpanMs,
  getRangeSpanDays,
  combineDateAndTime,
};
