/**
 * Human-readable labels for API search payload paths (UI / toast copy).
 * @module config/field-labels
 */

/** @type {Record<string, string>} */
const SEARCH_FIELD_LABELS = Object.freeze({
  filters: 'Filters',
  'filters.requested_at': 'Date range',
  'filters.merchant_id': 'Merchant',
  'filters.user_id': 'User',
  'filters.platform': 'Platform',
  'filters.api_provider': 'API provider',
  'filters.endpoint': 'Endpoint',
  'filters.endpoint_group': 'Endpoint group',
  'filters.http_method': 'HTTP method',
  'filters.http_status': 'HTTP status',
  'filters.success': 'Success',
  pagination: 'Pagination',
  'pagination.limit': 'Page size',
  'pagination.cursor': 'Page cursor',
  select_fields: 'Columns',
  sort: 'Sort',
  'sort.field': 'Sort field',
  'sort.order': 'Sort order',
  options: 'Options',
  'options.include_snapshots': 'Include snapshots',
  'options.include_total': 'Include total count',
});

/**
 * @param {Array<string|number>} path
 * @returns {string}
 */
function labelForPath(path) {
  const key = path.map(String).join('.');
  if (SEARCH_FIELD_LABELS[key]) {
    return SEARCH_FIELD_LABELS[key];
  }
  const last = path[path.length - 1];
  if (typeof last === 'string') {
    return last.replace(/_/g, ' ');
  }
  return 'Field';
}

module.exports = {
  SEARCH_FIELD_LABELS,
  labelForPath,
};
