/**
 * Sanitize, bound, and serialize HTTP snapshots for safe JSONB storage.
 * @module utils/snapshot-sanitizer
 */

const {
  MAX_SNAPSHOT_BYTES,
  MAX_JSON_DEPTH,
  MAX_STACK_LENGTH,
  MAX_TEXT_FIELD_LENGTH,
  SENSITIVE_HEADER_KEYS,
  SENSITIVE_FIELD_PATTERNS,
} = require('../config/vars');

const REDACTED = '[REDACTED]';

/**
 * @param {string} key
 * @returns {boolean}
 */
function isSensitiveFieldKey(key) {
  const lower = String(key).toLowerCase();
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * @param {string} headerName
 * @returns {boolean}
 */
function isSensitiveHeader(headerName) {
  const lower = String(headerName).toLowerCase();
  return SENSITIVE_HEADER_KEYS.includes(lower);
}

/**
 * @param {unknown} value
 * @param {number} depth
 * @param {WeakSet<object>} seen
 * @returns {unknown}
 */
function sanitizeValue(value, depth, seen) {
  if (value === undefined) {
    return null;
  }

  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'string') {
    return value.length > MAX_TEXT_FIELD_LENGTH
      ? `${value.slice(0, MAX_TEXT_FIELD_LENGTH)}…[truncated]`
      : value;
  }

  if (typeof value === 'function') {
    return '[Function]';
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer length=${value.length}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= MAX_JSON_DEPTH) {
    return '[MaxDepthExceeded]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);

    /** @type {Record<string, unknown>} */
    const output = {};

    for (const [key, nested] of Object.entries(value)) {
      output[key] = isSensitiveFieldKey(key) ? REDACTED : sanitizeValue(nested, depth + 1, seen);
    }

    seen.delete(value);
    return output;
  }

  return String(value);
}

/**
 * @param {unknown} headers
 * @returns {Record<string, unknown>|null}
 */
function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return null;
  }

  /** @type {Record<string, unknown>} */
  const output = {};

  for (const [key, value] of Object.entries(headers)) {
    output[key] = isSensitiveHeader(key) ? REDACTED : sanitizeValue(value, 0, new WeakSet());
  }

  return output;
}

/**
 * Deep-sanitize arbitrary snapshot data.
 *
 * @param {unknown} input
 * @returns {unknown}
 */
function sanitizeSnapshotData(input) {
  if (input === undefined || input === null) {
    return null;
  }

  return sanitizeValue(input, 0, new WeakSet());
}

/**
 * Enforces max serialized size for PostgreSQL JSONB inserts.
 *
 * @param {unknown} snapshot
 * @returns {unknown}
 */
function enforceSnapshotSizeLimit(snapshot) {
  if (snapshot === null || snapshot === undefined) {
    return null;
  }

  let serialized = JSON.stringify(snapshot);

  if (Buffer.byteLength(serialized, 'utf8') <= MAX_SNAPSHOT_BYTES) {
    return snapshot;
  }

  return {
    _truncated: true,
    _maxBytes: MAX_SNAPSHOT_BYTES,
    _originalBytes: Buffer.byteLength(serialized, 'utf8'),
    _preview: serialized.slice(0, MAX_SNAPSHOT_BYTES),
  };
}

/**
 * Sanitize and size-limit a snapshot object for persistence.
 *
 * @param {unknown} input
 * @returns {object|null}
 */
function prepareSnapshotForStorage(input) {
  const sanitized = sanitizeSnapshotData(input);
  if (sanitized === null) {
    return null;
  }

  const bounded = enforceSnapshotSizeLimit(sanitized);
  return bounded && typeof bounded === 'object' ? bounded : { value: bounded };
}

/**
 * @param {unknown} stack
 * @returns {string|null}
 */
function sanitizeStack(stack) {
  if (typeof stack !== 'string' || !stack) {
    return null;
  }

  return stack.length > MAX_STACK_LENGTH
    ? `${stack.slice(0, MAX_STACK_LENGTH)}…[truncated]`
    : stack;
}

module.exports = {
  prepareSnapshotForStorage,
  sanitizeHeaders,
  sanitizeSnapshotData,
  sanitizeStack,
  REDACTED,
};
