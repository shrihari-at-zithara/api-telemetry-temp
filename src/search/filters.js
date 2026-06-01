/**
 * Extensible filter registry for api_call_logs list queries.
 * @module search/filters
 */

/**
 * @typedef {'datetime_range' | 'uuid_list' | 'text_list' | 'boolean' | 'integer_list'} FilterType
 */

/**
 * @typedef {Object} FilterDefinition
 * @property {FilterType} type
 * @property {string} column
 * @property {boolean} [required]
 */

const ALLOWED_COLUMNS = new Set([
  'requested_at',
  'merchant_id',
  'user_id',
  'platform',
  'api_provider',
  'endpoint',
  'endpoint_group',
  'http_method',
  'http_status',
  'success',
]);

const FILTER_REGISTRY = Object.freeze({
  requested_at: { type: 'datetime_range', column: 'requested_at', required: true },
  merchant_id: { type: 'uuid_list', column: 'merchant_id' },
  user_id: { type: 'integer_list', column: 'user_id' },
  platform: { type: 'text_list', column: 'platform' },
  api_provider: { type: 'text_list', column: 'api_provider' },
  endpoint: { type: 'text_list', column: 'endpoint' },
  endpoint_group: { type: 'text_list', column: 'endpoint_group' },
  http_method: { type: 'text_list', column: 'http_method' },
  http_status: { type: 'integer_list', column: 'http_status' },
  success: { type: 'boolean', column: 'success' },
});

/**
 * @param {string} column
 * @returns {string}
 */
const assertAllowedColumn = (column) => {
  if (!ALLOWED_COLUMNS.has(column)) {
    throw new Error(`Disallowed filter column: ${column}`);
  }
  return column;
};

/**
 * @param {*} value
 * @returns {Array<*>}
 */
const toArray = (value) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

/**
 * @param {Record<string, *>} filters
 * @param {{ paramIndex: number }} state
 * @returns {{ conditions: string[], params: unknown[] }}
 */
function buildFilterConditions(filters, state = { paramIndex: 1 }) {
  const conditions = [];
  const params = [];

  const nextParam = () => `$${state.paramIndex++}`;

  for (const [key, rawValue] of Object.entries(filters || {})) {
    const definition = FILTER_REGISTRY[key];
    if (!definition || rawValue === undefined || rawValue === null) {
      continue;
    }

    const column = assertAllowedColumn(definition.column);

    switch (definition.type) {
      case 'datetime_range': {
        const { from, to } = rawValue;
        if (from) {
          conditions.push(`${column} >= ${nextParam()}`);
          params.push(from);
        }
        if (to) {
          conditions.push(`${column} < ${nextParam()}`);
          params.push(to);
        }
        break;
      }
      case 'uuid_list': {
        const values = toArray(rawValue);
        if (values.length === 0) break;
        conditions.push(`${column} = ANY(${nextParam()}::uuid[])`);
        params.push(values);
        break;
      }
      case 'integer_list': {
        const values = toArray(rawValue);
        if (values.length === 0) break;
        const pgType = column === 'user_id' ? 'bigint[]' : 'int[]';
        conditions.push(`${column} = ANY(${nextParam()}::${pgType})`);
        params.push(values.map((v) => Number(v)));
        break;
      }
      case 'text_list': {
        const values = toArray(rawValue)
          .map((v) => String(v).trim())
          .filter(Boolean);
        if (values.length === 0) break;
        conditions.push(`${column} = ANY(${nextParam()}::text[])`);
        params.push(values);
        break;
      }
      case 'boolean': {
        conditions.push(`${column} = ${nextParam()}`);
        params.push(Boolean(rawValue));
        break;
      }
      default:
        break;
    }
  }

  return { conditions, params };
}

module.exports = {
  FILTER_REGISTRY,
  ALLOWED_COLUMNS,
  buildFilterConditions,
};
