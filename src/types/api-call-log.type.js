/**
 * JSDoc type definitions for API call log payloads and results.
 * @module types/api-call-log
 */

/**
 * Outbound HTTP request capture (before sanitize/persist).
 *
 * @typedef {object} HttpRequestCapture
 * @property {unknown} [body]
 * @property {unknown} [params]
 * @property {unknown} [query]
 * @property {unknown} [headers]
 * @property {unknown} [cookies]
 */

/**
 * Raw input from a consuming service before normalization.
 *
 * @typedef {object} ApiCallLogInput
 * @property {string} merchant_id - Merchant UUID.
 * @property {number} [user_id] - Agent user id (`users.id`, BIGINT).
 * @property {string} [instagram_page_id] - Instagram page / professional account id.
 * @property {string} platform - Channel surface: `instagram`, `facebook`, `whatsapp`, or `internal` (not `meta`).
 * @property {string} api_provider - API vendor: e.g. `meta` for Graph API, or `zithara` for internal services.
 * @property {string} endpoint - Normalized API path without secrets (required).
 * @property {string} [endpoint_group] - Dashboard grouping key.
 * @property {string} http_method - HTTP verb (required).
 * @property {number} [http_status] - Response status code.
 * @property {boolean} success - Whether the call succeeded.
 * @property {number} response_time_ms - Round-trip latency in milliseconds (required, ≥ 0).
 * @property {string} [error_code] - Provider or application error code.
 * @property {string} [error_message] - Human-readable error summary.
 * @property {string} [request_id] - Correlation id from the caller.
 * @property {string} [trace_id] - Distributed trace UUID.
 * @property {Date|string} [requested_at] - When the outbound call was made.
 * @property {HttpRequestCapture|object} [request] - Shorthand; sanitized into `request_snapshot`.
 * @property {object} [request_snapshot] - Pre-built request snapshot (body, params, query, headers, cookies).
 * @property {object} [response] - Shorthand success response (`data`, `status`, `headers`).
 * @property {unknown} [error] - Shorthand error (axios error, Error, etc.) for catch blocks.
 * @property {object} [response_snapshot] - Pre-built response/error snapshot.
 */

/**
 * Normalized record ready for persistence.
 *
 * @typedef {object} ApiCallLogRecord
 * @property {string} merchant_id
 * @property {number|null} user_id
 * @property {string|null} instagram_page_id
 * @property {string} platform
 * @property {string} api_provider
 * @property {string} endpoint
 * @property {string|null} endpoint_group
 * @property {string} http_method
 * @property {number|null} http_status
 * @property {boolean} success
 * @property {number} response_time_ms
 * @property {string|null} error_code
 * @property {string|null} error_message
 * @property {string|null} request_id
 * @property {string|null} trace_id
 * @property {object|null} request_snapshot
 * @property {object|null} response_snapshot
 * @property {Date|null} requested_at
 */

/**
 * Result returned after a successful insert.
 *
 * @typedef {object} ApiCallLogResult
 * @property {string} id - Inserted row UUID.
 * @property {Date} requested_at - Stored timestamp.
 */

module.exports = {};
