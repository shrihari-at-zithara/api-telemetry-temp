/**
 * User-facing and log message templates for telemetry errors.
 * @module config/messages
 */

const { telemetryConfig } = require('./telemetry.config');

const searchLimits = () => telemetryConfig.search;

const MESSAGES = Object.freeze({
  search: {
    validationSummary: (count) =>
      count === 1
        ? 'Please fix the highlighted search filter and try again.'
        : `Please fix ${count} search filters and try again.`,
    unknownTopLevelKey: (key) =>
      `"${key}" is not a valid search option. Use filters, pagination, sort, or options only.`,
    unknownFilterKey: (key) =>
      `"${key}" is not a supported filter. Check the filter name and try again.`,
    requestedAtRequired: () => 'Select a start date and an end date.',
    requestedAtInvalid: () => 'Enter a valid date range.',
    requestedAtOrder: () => 'Start date must be before end date.',
    requestedAtRangeExceeded: () =>
      `Date range cannot be longer than ${searchLimits().maxRangeDays} days.`,
    includeTotalRangeExceeded: () =>
      `Total count is only available for date ranges up to ${searchLimits().maxTotalCountRangeDays} days.`,
    snapshotLimitExceeded: () =>
      `When including request/response data, page size cannot exceed ${searchLimits().maxSnapshotLimit}.`,
    disallowedSelectField: (field) => `"${field}" cannot be selected. Choose a column from the allowed list.`,
    disallowedQueryColumn: (column) => `Cannot query column "${column}".`,
    queryTimedOut: () => 'The search took too long. Narrow your date range or filters and try again.',
    httpStatusRange: () => 'HTTP status must be a whole number between 100 and 599.',
    httpStatusInvalid: () => 'HTTP status must be a whole number between 100 and 599.',
    httpMethodInvalid: () => 'Choose a valid HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, or OPTIONS).',
    merchantIdInvalid: () => 'Merchant must be a valid ID.',
    pageSizeMin: () => 'Page size must be at least 1.',
    pageSizeMax: (max) => `Page size cannot exceed ${max}.`,
    invalidUuid: (label) => `${label} must be a valid ID.`,
    invalidDate: (label) => `${label} must be a valid date.`,
    invalidBoolean: (label) => `${label} must be true or false.`,
    emptyString: (label) => `${label} cannot be empty.`,
    duplicateSelectFields: () => 'Remove duplicate column names.',
    emptySelectFields: () => 'Select at least one column.',
    invalidSelectField: (field) => `"${field}" is not an available column.`,
  },
  write: {
    payloadNotObject: () => 'payload must be a non-null object',
  },
  db: {
    insertFailed: () => 'Failed to insert API call log',
    poolRequired: () =>
      'Database query is not available. Call initializeApiTelemetry({ pool }) with a pg Pool, or pass { query, runInTransaction } for Sequelize.',
    transactionRequired: () =>
      'runInTransaction requires a pg Pool with connect(), or initializeApiTelemetry({ query, runInTransaction }) for Sequelize.',
    poolConnectRequired: () =>
      'initializeApiTelemetry: pool must be a native pg Pool (with connect). For Sequelize, pass { query, runInTransaction } instead of pool.',
    initPoolOrQuery: () => 'initializeApiTelemetry: provide either pool or query, not both',
  },
});

module.exports = {
  MESSAGES,
};
