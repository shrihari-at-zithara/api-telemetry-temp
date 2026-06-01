/**
 * Data access for api_call_logs search (read paths).
 *
 * Uses keyset pagination on (requested_at, id). Recommended indexes:
 * sql/indexes-api-call-logs.sql
 *
 * @module search/repository
 */

const { withStatementTimeout } = require('../db/query-with-timeout');
const { buildFilterConditions } = require('./filters');
const { buildSelectClause } = require('./select-fields');

const TABLE_NAME = 'api_call_logs';

/**
 * @param {object} params
 * @param {'asc'|'desc'} params.sortOrder
 * @param {{ requested_at: Date, id: string }|null} params.cursor
 * @param {{ conditions: string[], params: unknown[], paramIndex: number }} builder
 */
const appendKeysetCursor = ({ sortOrder, cursor }, builder) => {
  if (!cursor?.requested_at || !cursor?.id) {
    return;
  }

  const requestedAtParam = `$${builder.paramIndex++}`;
  const idParam = `$${builder.paramIndex++}`;
  const comparator = sortOrder === 'asc' ? '>' : '<';

  builder.conditions.push(
    `(${TABLE_NAME}.requested_at, ${TABLE_NAME}.id) ${comparator} (${requestedAtParam}::timestamptz, ${idParam}::uuid)`
  );
  builder.params.push(cursor.requested_at, cursor.id);
};

/**
 * @param {object} options
 * @param {Record<string, *>} options.filters
 * @param {string[]} options.queryColumns
 * @param {number} options.limit
 * @param {{ requested_at: Date, id: string }|null} [options.cursor]
 * @param {'asc'|'desc'} [options.sortOrder='desc']
 * @returns {Promise<{ rows: object[], hasMore: boolean }>}
 */
async function listApiCallLogs({
  filters,
  queryColumns,
  limit,
  cursor = null,
  sortOrder = 'desc',
}) {
  const builder = { conditions: [], params: [], paramIndex: 1 };

  const filterResult = buildFilterConditions(filters, builder);
  builder.conditions.push(...filterResult.conditions);
  builder.params.push(...filterResult.params);

  appendKeysetCursor({ sortOrder, cursor }, builder);

  const whereClause =
    builder.conditions.length > 0 ? `WHERE ${builder.conditions.join(' AND ')}` : '';

  const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const limitParam = `$${builder.paramIndex++}`;
  const fetchLimit = limit + 1;

  builder.params.push(fetchLimit);

  const selectClause = buildSelectClause(queryColumns, TABLE_NAME);

  const sql = `
    SELECT
        ${selectClause}
    FROM ${TABLE_NAME}
    ${whereClause}
    ORDER BY ${TABLE_NAME}.requested_at ${orderDirection}, ${TABLE_NAME}.id ${orderDirection}
    LIMIT ${limitParam}
  `;

  const rows = await withStatementTimeout(async (client) => {
    const result = await client.query(sql, builder.params);
    return result.rows;
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return { rows: items, hasMore };
}

/**
 * @param {Record<string, *>} filters
 * @returns {Promise<number>}
 */
async function countApiCallLogs(filters) {
  const builder = { conditions: [], params: [], paramIndex: 1 };
  const filterResult = buildFilterConditions(filters, builder);
  builder.conditions.push(...filterResult.conditions);
  builder.params.push(...filterResult.params);

  const whereClause =
    builder.conditions.length > 0 ? `WHERE ${builder.conditions.join(' AND ')}` : '';

  const sql = `
    SELECT COUNT(*)::int AS total
    FROM ${TABLE_NAME}
    ${whereClause}
  `;

  const [row] = await withStatementTimeout(async (client) => {
    const result = await client.query(sql, builder.params);
    return result.rows;
  });

  return row?.total ?? 0;
}

module.exports = {
  listApiCallLogs,
  countApiCallLogs,
  TABLE_NAME,
};
