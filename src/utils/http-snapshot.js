/**
 * Build normalized request/response snapshots for outbound HTTP calls.
 * Use after the call completes or inside catch/finally blocks.
 * @module utils/http-snapshot
 */

const {
  prepareSnapshotForStorage,
  sanitizeHeaders,
  sanitizeSnapshotData,
  sanitizeStack,
} = require('./snapshot-sanitizer');

/**
 * @typedef {object} RequestSnapshotInput
 * @property {unknown} [body] - Request body / payload.
 * @property {unknown} [params] - Path parameters.
 * @property {unknown} [query] - Query-string parameters.
 * @property {unknown} [headers] - Outbound request headers.
 * @property {unknown} [cookies] - Parsed cookies when available.
 */

/**
 * @typedef {object} HttpSnapshotOptions
 * @property {boolean} [persist=true] - When false, returns sanitized object without size cap (for tests).
 */

/**
 * Captures full outbound request context (body, params, query, headers, cookies).
 *
 * @param {RequestSnapshotInput} [input]
 * @param {HttpSnapshotOptions} [options]
 * @returns {object|null}
 */
function buildRequestSnapshot(input = {}, options = {}) {
  const snapshot = {
    body: sanitizeSnapshotData(input.body ?? null),
    params: sanitizeSnapshotData(input.params ?? null),
    query: sanitizeSnapshotData(input.query ?? null),
    headers: sanitizeHeaders(input.headers),
    cookies: sanitizeSnapshotData(input.cookies ?? null),
  };

  const hasContent = Object.values(snapshot).some((value) => value !== null);
  if (!hasContent) {
    return null;
  }

  return options.persist === false ? snapshot : prepareSnapshotForStorage(snapshot);
}

/**
 * @param {object} response
 * @param {number} [response.status]
 * @param {unknown} [response.data]
 * @param {unknown} [response.headers]
 * @param {HttpSnapshotOptions} [options]
 * @returns {object|null}
 */
function buildResponseSnapshotFromSuccess(response, options = {}) {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const snapshot = {
    kind: 'success',
    status: typeof response.status === 'number' ? response.status : null,
    headers: sanitizeHeaders(response.headers),
    body: sanitizeSnapshotData(response.data ?? response.body ?? null),
  };

  return options.persist === false ? snapshot : prepareSnapshotForStorage(snapshot);
}

/**
 * Normalizes axios-style errors, fetch failures, and generic Error objects.
 *
 * @param {unknown} error
 * @param {HttpSnapshotOptions} [options]
 * @returns {object|null}
 */
function buildResponseSnapshotFromError(error, options = {}) {
  if (!error) {
    return null;
  }

  /** @type {Record<string, unknown>} */
  const snapshot = {
    kind: 'error',
  };

  if (typeof error === 'object' && error !== null) {
    const err = /** @type {Record<string, unknown>} */ (error);
    const response =
      err.response && typeof err.response === 'object'
        ? /** @type {Record<string, unknown>} */ (err.response)
        : null;

    if (response) {
      snapshot.status = typeof response.status === 'number' ? response.status : null;
      snapshot.headers = sanitizeHeaders(response.headers);
      snapshot.body = sanitizeSnapshotData(response.data ?? null);
    }

    snapshot.error = sanitizeSnapshotData({
      name: typeof err.name === 'string' ? err.name : 'Error',
      message: typeof err.message === 'string' ? err.message : String(error),
      code: err.code ?? null,
      stack: sanitizeStack(typeof err.stack === 'string' ? err.stack : null),
    });
  } else {
    snapshot.error = sanitizeSnapshotData({
      name: 'Error',
      message: String(error),
    });
  }

  return options.persist === false ? snapshot : prepareSnapshotForStorage(snapshot);
}

/**
 * @param {boolean} success
 * @param {unknown} responseOrError - Axios response, axios error, or generic error.
 * @param {HttpSnapshotOptions} [options]
 * @returns {object|null}
 */
function buildResponseSnapshot(success, responseOrError, options = {}) {
  if (success) {
    return buildResponseSnapshotFromSuccess(
      responseOrError && typeof responseOrError === 'object' ? responseOrError : {},
      options
    );
  }

  return buildResponseSnapshotFromError(responseOrError, options);
}

/**
 * Maps an axios request config to {@link buildRequestSnapshot}.
 *
 * @param {object} config - Axios request config (`error.config` or pre-call config).
 * @param {HttpSnapshotOptions} [options]
 * @returns {object|null}
 */
function buildRequestSnapshotFromAxiosConfig(config, options = {}) {
  if (!config || typeof config !== 'object') {
    return null;
  }

  return buildRequestSnapshot(
    {
      body: config.data,
      params: config.params,
      query: config.params,
      headers: config.headers,
    },
    options
  );
}

module.exports = {
  buildRequestSnapshot,
  buildResponseSnapshot,
  buildResponseSnapshotFromSuccess,
  buildResponseSnapshotFromError,
  buildRequestSnapshotFromAxiosConfig,
};
