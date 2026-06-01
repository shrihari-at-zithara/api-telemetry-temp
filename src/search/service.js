/**
 * Business logic for api_call_logs search.
 * @module search/service
 */

const { validateSearchPayload } = require('./validate-payload');
const { listApiCallLogs, countApiCallLogs } = require('./repository');
const { resolveRequestedAtRange } = require('./date-range');
const { enforceQueryGuardrails } = require('./guardrails');
const {
  resolveFieldSelection,
  projectRow,
  KEYSET_FIELDS,
} = require('./select-fields');
const { telemetryConfig } = require('../config/telemetry.config');

/**
 * @param {object} filters
 * @returns {Record<string, *>}
 */
function normalizeFilters(filters) {
  const { requested_at: requestedAtRaw, http_method: httpMethod, ...rest } = filters;
  const requestedAt = resolveRequestedAtRange(requestedAtRaw);

  const normalized = {
    requested_at: requestedAt,
    ...rest,
  };

  if (httpMethod !== undefined) {
    normalized.http_method = Array.isArray(httpMethod)
      ? httpMethod.map((method) => String(method).toUpperCase())
      : String(httpMethod).toUpperCase();
  }

  return normalized;
}

/**
 * @param {object|null} lastRow
 * @returns {{ requested_at: string, id: string }|null}
 */
function buildNextCursor(lastRow) {
  if (!lastRow?.requested_at || !lastRow?.id) {
    return null;
  }

  return {
    requested_at: new Date(lastRow.requested_at).toISOString(),
    id: lastRow.id,
  };
}

/**
 * Searches api_call_logs with filters, guardrails, and optional field selection.
 *
 * Requires `initializeApiTelemetry({ pool })` (or env-based pool) before use.
 *
 * @param {object} body - Raw POST body
 * @returns {Promise<{
 *   items: object[],
 *   pagination: { limit: number, has_more: boolean, next_cursor: object|null },
 *   meta?: { total: number }
 * }>}
 */
async function searchApiCallLogs(body) {
  const payload = validateSearchPayload(body);
  const filters = normalizeFilters(payload.filters);
  const requestedAtRange = filters.requested_at;

  const limit = payload.pagination.limit;
  const cursor = payload.pagination.cursor || null;
  const sortOrder = payload.sort.order;

  const { responseFields, queryColumns, includeSnapshots } = resolveFieldSelection(
    payload.select_fields,
    payload.options
  );

  enforceQueryGuardrails({
    requestedAtRange,
    limit,
    includeTotal: payload.options.include_total,
    includeSnapshots,
  });

  const { rows, hasMore } = await listApiCallLogs({
    filters,
    queryColumns,
    limit,
    cursor,
    sortOrder,
  });

  const items = rows.map((row) => projectRow(row, responseFields));

  const response = {
    items,
    pagination: {
      limit,
      has_more: hasMore,
      next_cursor: hasMore ? buildNextCursor(rows[rows.length - 1]) : null,
    },
  };

  if (payload.options.include_total) {
    const total = await countApiCallLogs(filters);
    response.meta = { total };
  }

  return response;
}

module.exports = {
  searchApiCallLogs,
  normalizeFilters,
  buildNextCursor,
  resolveRequestedAtRange,
  MAX_RANGE_DAYS: telemetryConfig.search.maxRangeDays,
  KEYSET_FIELDS,
};
