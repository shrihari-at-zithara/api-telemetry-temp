/**
 * Shared environment variable parsing.
 * @module utils/parse-env
 */

/**
 * @param {string | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

/**
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function parsePositiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  return parsePositiveInt(raw, fallback);
}

module.exports = {
  parsePositiveInt,
  parsePositiveIntEnv,
};
