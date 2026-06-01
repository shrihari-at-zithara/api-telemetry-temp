/**
 * Joi validation helper — maps failures to {@link SearchValidationError}.
 * @module utils/joi-validate
 */

const { SearchValidationError } = require('./errors');
const { formatJoiValidationError } = require('./format-joi-error');

/**
 * @param {unknown} value
 * @param {import('joi').ObjectSchema} schema
 * @returns {object}
 */
function validateWithJoiSchema(value, schema) {
  const { error, value: validated } = schema.validate(value, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const { message, details } = formatJoiValidationError(error);
    throw new SearchValidationError(message, details);
  }

  return validated;
}

module.exports = {
  validateWithJoiSchema,
};
