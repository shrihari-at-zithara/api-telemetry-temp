/**
 * Joi validation for api_call_logs search requests.
 * @module search/validate-payload
 */

const Joi = require('joi');
const { telemetryConfig } = require('../config/telemetry.config');
const { MESSAGES } = require('../config/messages');
const { FILTER_REGISTRY } = require('./filters');
const { SELECTABLE_FIELDS } = require('./select-fields');
const { validateWithJoiSchema } = require('../utils/joi-validate');

const { search: searchLimits } = telemetryConfig;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const selectableFieldNames = [...SELECTABLE_FIELDS];
const allowedFilterKeys = Object.keys(FILTER_REGISTRY);

const httpStatusSchema = Joi.number()
  .integer()
  .min(100)
  .max(599)
  .messages({
    'number.base': MESSAGES.search.httpStatusInvalid(),
    'number.integer': MESSAGES.search.httpStatusInvalid(),
    'number.min': MESSAGES.search.httpStatusRange(),
    'number.max': MESSAGES.search.httpStatusRange(),
  });

const requestedAtSchema = Joi.object({
  from: Joi.date().iso().optional().messages({
    'date.format': MESSAGES.search.invalidDate('Start date'),
  }),
  to: Joi.date().iso().optional().messages({
    'date.format': MESSAGES.search.invalidDate('End date'),
  }),
  date_from: Joi.string().pattern(DATE_PATTERN).optional().messages({
    'string.pattern.base': 'Start date must be in YYYY-MM-DD format.',
  }),
  date_to: Joi.string().pattern(DATE_PATTERN).optional().messages({
    'string.pattern.base': 'End date must be in YYYY-MM-DD format.',
  }),
  time_from: Joi.string().pattern(TIME_PATTERN).optional().messages({
    'string.pattern.base': 'Start time must be in HH:mm format.',
  }),
  time_to: Joi.string().pattern(TIME_PATTERN).optional().messages({
    'string.pattern.base': 'End time must be in HH:mm format.',
  }),
})
  .or('from', 'date_from')
  .or('to', 'date_to')
  .messages({
    'object.missing': MESSAGES.search.requestedAtRequired(),
  });

const filtersSchema = Joi.object({
  requested_at: requestedAtSchema.required(),
  merchant_id: Joi.alternatives()
    .try(Joi.string().uuid(), Joi.array().items(Joi.string().uuid()).min(1))
    .optional()
    .messages({
      'string.guid': MESSAGES.search.merchantIdInvalid(),
      'alternatives.match': MESSAGES.search.merchantIdInvalid(),
    }),
  user_id: Joi.alternatives()
    .try(Joi.number().integer(), Joi.array().items(Joi.number().integer()).min(1))
    .optional(),
  platform: Joi.alternatives()
    .try(Joi.string().trim().min(1), Joi.array().items(Joi.string().trim().min(1)).min(1))
    .optional()
    .messages({ 'string.min': MESSAGES.search.emptyString('Platform') }),
  api_provider: Joi.alternatives()
    .try(Joi.string().trim().min(1), Joi.array().items(Joi.string().trim().min(1)).min(1))
    .optional()
    .messages({ 'string.min': MESSAGES.search.emptyString('API provider') }),
  endpoint: Joi.alternatives()
    .try(Joi.string().trim().min(1), Joi.array().items(Joi.string().trim().min(1)).min(1))
    .optional()
    .messages({ 'string.min': MESSAGES.search.emptyString('Endpoint') }),
  endpoint_group: Joi.alternatives()
    .try(Joi.string().trim().min(1), Joi.array().items(Joi.string().trim().min(1)).min(1))
    .optional()
    .messages({ 'string.min': MESSAGES.search.emptyString('Endpoint group') }),
  http_method: Joi.alternatives()
    .try(
      Joi.string().valid(...HTTP_METHODS).insensitive(),
      Joi.array().items(Joi.string().valid(...HTTP_METHODS).insensitive()).min(1)
    )
    .optional()
    .messages({
      'any.only': MESSAGES.search.httpMethodInvalid(),
      'alternatives.match': MESSAGES.search.httpMethodInvalid(),
    }),
  http_status: Joi.alternatives()
    .try(httpStatusSchema, Joi.array().items(httpStatusSchema).min(1))
    .optional()
    .messages({
      'alternatives.match': MESSAGES.search.httpStatusRange(),
    }),
  success: Joi.boolean().optional().messages({
    'boolean.base': MESSAGES.search.invalidBoolean('Success'),
  }),
})
  .required()
  .unknown(false);

const searchPayloadSchema = Joi.object({
  filters: filtersSchema,
  select_fields: Joi.array()
    .items(Joi.string().valid(...selectableFieldNames))
    .min(1)
    .unique()
    .optional()
    .messages({
      'array.min': MESSAGES.search.emptySelectFields(),
      'array.unique': MESSAGES.search.duplicateSelectFields(),
    }),
  pagination: Joi.object({
    limit: Joi.number()
      .integer()
      .min(1)
      .max(searchLimits.maxLimit)
      .default(searchLimits.defaultLimit)
      .messages({
        'number.max': MESSAGES.search.pageSizeMax(searchLimits.maxLimit),
        'number.min': MESSAGES.search.pageSizeMin(),
        'number.base': 'Page size must be a number.',
      }),
    cursor: Joi.object({
      requested_at: Joi.date().iso().required(),
      id: Joi.string().uuid().required(),
    })
      .optional()
      .messages({
        'any.required': 'Pagination cursor is incomplete.',
      }),
  }).default({ limit: searchLimits.defaultLimit }),
  sort: Joi.object({
    field: Joi.string().valid('requested_at').default('requested_at'),
    order: Joi.string().valid('asc', 'desc').default('desc'),
  })
    .default({ field: 'requested_at', order: 'desc' })
    .unknown(false),
  options: Joi.object({
    include_snapshots: Joi.boolean().default(false),
    include_total: Joi.boolean().default(false),
  })
    .default({ include_snapshots: false, include_total: false })
    .unknown(false),
}).unknown(false);

/**
 * @param {object} body
 * @returns {object}
 */
function validateSearchPayload(body) {
  return validateWithJoiSchema(body, searchPayloadSchema);
}

module.exports = {
  searchPayloadSchema,
  validateSearchPayload,
  filterKeys: allowedFilterKeys,
  selectableFieldNames,
};
