/**
 * Allow-listed response field selection for api_call_logs search.
 * @module search/select-fields
 */

const { MESSAGES } = require('../config/messages');
const { SearchValidationError } = require('../utils/errors');

/** Fields clients may request via select_fields. */
const SELECTABLE_FIELDS = new Set([
  'id',
  'merchant_id',
  'user_id',
  'platform',
  'api_provider',
  'endpoint',
  'endpoint_group',
  'http_method',
  'http_status',
  'success',
  'response_time_ms',
  'error_code',
  'error_message',
  'request_id',
  'trace_id',
  'requested_at',
  'request_snapshot',
  'response_snapshot',
]);

/** Default columns when select_fields is omitted (backward compatible). */
const DEFAULT_RESPONSE_FIELDS = [
  'id',
  'merchant_id',
  'user_id',
  'instagram_page_id',
  'platform',
  'api_provider',
  'endpoint',
  'endpoint_group',
  'http_method',
  'http_status',
  'success',
  'response_time_ms',
  'error_code',
  'error_message',
  'request_id',
  'trace_id',
  'requested_at',
];

const SNAPSHOT_FIELDS = ['request_snapshot', 'response_snapshot'];

/** Required internally for keyset pagination (may be omitted from API response). */
const KEYSET_FIELDS = ['requested_at', 'id'];

/** Stable ordering for SELECT lists and response projection. */
const FIELD_ORDER = [
  ...DEFAULT_RESPONSE_FIELDS.filter((f) => !SNAPSHOT_FIELDS.includes(f)),
  ...SNAPSHOT_FIELDS,
];

/**
 * @param {string[]} fields
 * @returns {string[]}
 */
function sortFields(fields) {
  const index = new Map(FIELD_ORDER.map((name, i) => [name, i]));
  return [...fields].sort((a, b) => {
    const ai = index.has(a) ? index.get(a) : FIELD_ORDER.length;
    const bi = index.has(b) ? index.get(b) : FIELD_ORDER.length;
    return ai - bi;
  });
}

/**
 * @param {string} field
 */
function assertSelectableField(field) {
  if (!SELECTABLE_FIELDS.has(field)) {
    throw new SearchValidationError(MESSAGES.search.disallowedSelectField(field), [
      MESSAGES.search.disallowedSelectField(field),
    ]);
  }
}

/**
 * @param {string[]} responseFields
 * @returns {string[]}
 */
function resolveQueryColumns(responseFields) {
  const merged = new Set([...responseFields, ...KEYSET_FIELDS]);
  return sortFields([...merged]);
}

/**
 * @param {string[]|undefined} selectFields
 * @param {{ include_snapshots?: boolean }} options
 */
function resolveFieldSelection(selectFields, options = {}) {
  const includeSnapshotsOption = Boolean(options.include_snapshots);

  if (!selectFields || selectFields.length === 0) {
    const responseFields = [...DEFAULT_RESPONSE_FIELDS];
    if (includeSnapshotsOption) {
      SNAPSHOT_FIELDS.forEach((field) => {
        if (!responseFields.includes(field)) {
          responseFields.push(field);
        }
      });
    }
    const sortedResponse = sortFields(responseFields);
    return {
      responseFields: sortedResponse,
      queryColumns: resolveQueryColumns(sortedResponse),
      includeSnapshots:
        includeSnapshotsOption ||
        SNAPSHOT_FIELDS.some((field) => sortedResponse.includes(field)),
    };
  }

  selectFields.forEach(assertSelectableField);

  const responseFields = sortFields([...new Set(selectFields)]);
  const snapshotsFromSelection = SNAPSHOT_FIELDS.some((field) =>
    responseFields.includes(field)
  );

  return {
    responseFields,
    queryColumns: resolveQueryColumns(responseFields),
    includeSnapshots: includeSnapshotsOption || snapshotsFromSelection,
  };
}

/**
 * @param {string[]} columnNames
 * @param {string} tableName
 * @returns {string}
 */
function buildSelectClause(columnNames, tableName = 'api_call_logs') {
  columnNames.forEach((column) => {
    if (
      !SELECTABLE_FIELDS.has(column) &&
      !DEFAULT_RESPONSE_FIELDS.includes(column) &&
      !KEYSET_FIELDS.includes(column)
    ) {
      throw new SearchValidationError(MESSAGES.search.disallowedQueryColumn(column), [
        MESSAGES.search.disallowedQueryColumn(column),
      ]);
    }
  });

  return columnNames.map((column) => `${tableName}.${column}`).join(',\n        ');
}

/**
 * @param {object} row
 * @param {string[]} responseFields
 * @returns {object}
 */
function projectRow(row, responseFields) {
  const projected = {};
  responseFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(row, field)) {
      projected[field] = row[field];
    }
  });
  return projected;
}

module.exports = {
  SELECTABLE_FIELDS,
  DEFAULT_RESPONSE_FIELDS,
  SNAPSHOT_FIELDS,
  KEYSET_FIELDS,
  FIELD_ORDER,
  resolveFieldSelection,
  resolveQueryColumns,
  buildSelectClause,
  projectRow,
  sortFields,
};
