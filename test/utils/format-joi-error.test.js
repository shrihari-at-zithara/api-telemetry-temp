/**
 * User-friendly Joi error formatting.
 */

const { validateSearchPayload } = require('../../src/search/validate-payload');
const { SearchValidationError } = require('../../src/utils/errors');
const { MESSAGES } = require('../../src/config/messages');

const baseFilters = {
  requested_at: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-05-03T00:00:00.000Z',
  },
};

describe('formatJoiValidationError / validateSearchPayload messages', () => {
  it('returns friendly message for http_status above 599', () => {
    expect(() =>
      validateSearchPayload({
        filters: {
          ...baseFilters,
          http_status: 900,
        },
      })
    ).toThrow(SearchValidationError);

    try {
      validateSearchPayload({
        filters: {
          ...baseFilters,
          http_status: 900,
        },
      });
    } catch (err) {
      expect(err.message).toBe(MESSAGES.search.httpStatusRange());
      expect(err.message).not.toMatch(/filters\.http_status/);
    }
  });

  it('returns friendly message for http_status below 100', () => {
    expect(() =>
      validateSearchPayload({
        filters: { ...baseFilters, http_status: 50 },
      })
    ).toThrow(MESSAGES.search.httpStatusRange());
  });

  it('returns friendly message for unknown filter key', () => {
    expect(() =>
      validateSearchPayload({
        filters: {
          ...baseFilters,
          not_a_real_column: 1,
        },
      })
    ).toThrow(/not a supported filter/i);
  });

  it('returns friendly message for limit over max', () => {
    expect(() =>
      validateSearchPayload({
        filters: baseFilters,
        pagination: { limit: 500 },
      })
    ).toThrow(/page size cannot exceed/i);
  });
});
