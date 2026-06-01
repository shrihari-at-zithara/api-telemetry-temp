/**
 * Unit tests for api_call_logs search guardrails and select_fields.
 */

const { validateSearchPayload } = require('../../src/search/validate-payload');
const { enforceQueryGuardrails } = require('../../src/search/guardrails');
const { SearchValidationError, GuardrailError } = require('../../src/utils/errors');
const { ERROR_CODES } = require('../../src/config/error-codes');
const {
  resolveFieldSelection,
  projectRow,
  resolveQueryColumns,
  SELECTABLE_FIELDS,
} = require('../../src/search/select-fields');
const { resolveRequestedAtRange, getRangeSpanDays } = require('../../src/search/date-range');
const {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_RANGE_DAYS,
  MAX_TOTAL_COUNT_RANGE_DAYS,
  MAX_SNAPSHOT_LIMIT,
  formatStatementTimeout,
} = require('../../src/search/constants');
const { buildNextCursor } = require('../../src/search/service');

const baseFilters = {
  requested_at: {
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-05-03T00:00:00.000Z',
  },
};

describe('search/constants', () => {
  it('exposes expected guardrail defaults', () => {
    expect(DEFAULT_LIMIT).toBe(50);
    expect(MAX_LIMIT).toBe(100);
    expect(MAX_RANGE_DAYS).toBe(31);
    expect(MAX_TOTAL_COUNT_RANGE_DAYS).toBe(7);
    expect(MAX_SNAPSHOT_LIMIT).toBe(25);
  });

  it('formats statement timeout for PostgreSQL', () => {
    expect(formatStatementTimeout(10000)).toBe('10s');
    expect(formatStatementTimeout(500)).toBe('500ms');
  });
});

describe('validateSearchPayload', () => {
  it('applies default limit', () => {
    const payload = validateSearchPayload({ filters: baseFilters });
    expect(payload.pagination.limit).toBe(DEFAULT_LIMIT);
  });

  it('rejects limit above MAX_LIMIT', () => {
    expect(() =>
      validateSearchPayload({
        filters: baseFilters,
        pagination: { limit: MAX_LIMIT + 1 },
      })
    ).toThrow(SearchValidationError);

    try {
      validateSearchPayload({
        filters: baseFilters,
        pagination: { limit: MAX_LIMIT + 1 },
      });
    } catch (err) {
      expect(err.code).toBe(ERROR_CODES.SEARCH_VALIDATION_ERROR);
      expect(err.message).toMatch(/page size cannot exceed/i);
    }
  });

  it('rejects limit below 1', () => {
    expect(() =>
      validateSearchPayload({
        filters: baseFilters,
        pagination: { limit: 0 },
      })
    ).toThrow();
  });

  it('rejects unknown select_fields', () => {
    expect(() =>
      validateSearchPayload({
        filters: baseFilters,
        select_fields: ['not_a_column'],
      })
    ).toThrow();
  });

  it('rejects duplicate select_fields', () => {
    expect(() =>
      validateSearchPayload({
        filters: baseFilters,
        select_fields: ['id', 'id'],
      })
    ).toThrow();
  });

  it('rejects empty select_fields array', () => {
    expect(() =>
      validateSearchPayload({
        filters: baseFilters,
        select_fields: [],
      })
    ).toThrow();
  });

  it('accepts valid select_fields', () => {
    const payload = validateSearchPayload({
      filters: baseFilters,
      select_fields: ['endpoint', 'http_status'],
    });
    expect(payload.select_fields).toEqual(['endpoint', 'http_status']);
  });

  it('rejects unknown top-level keys', () => {
    expect(() =>
      validateSearchPayload({
        filters: baseFilters,
        unknown_column: true,
      })
    ).toThrow(SearchValidationError);
  });

  it('rejects unknown filter keys (not database columns)', () => {
    expect(() =>
      validateSearchPayload({
        filters: {
          ...baseFilters,
          fake_attribute: 'x',
        },
      })
    ).toThrow(SearchValidationError);
  });
});

describe('resolveRequestedAtRange', () => {
  it('rejects ranges wider than MAX_RANGE_DAYS', () => {
    expect(() =>
      resolveRequestedAtRange({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-03-01T00:00:00.000Z',
      })
    ).toThrow(GuardrailError);
  });
});

describe('enforceQueryGuardrails', () => {
  const shortRange = resolveRequestedAtRange(baseFilters.requested_at);
  const longRange = resolveRequestedAtRange({
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-05-20T00:00:00.000Z',
  });

  it('rejects include_total when range exceeds MAX_TOTAL_COUNT_RANGE_DAYS', () => {
    expect(() =>
      enforceQueryGuardrails({
        requestedAtRange: longRange,
        limit: 10,
        includeTotal: true,
        includeSnapshots: false,
      })
    ).toThrow(/total count is only available/i);

    expect(getRangeSpanDays(longRange)).toBeGreaterThan(MAX_TOTAL_COUNT_RANGE_DAYS);
  });

  it('allows include_total within MAX_TOTAL_COUNT_RANGE_DAYS', () => {
    expect(() =>
      enforceQueryGuardrails({
        requestedAtRange: shortRange,
        limit: 10,
        includeTotal: true,
        includeSnapshots: false,
      })
    ).not.toThrow();
  });

  it('rejects include_snapshots when limit exceeds MAX_SNAPSHOT_LIMIT', () => {
    expect(() =>
      enforceQueryGuardrails({
        requestedAtRange: shortRange,
        limit: MAX_SNAPSHOT_LIMIT + 1,
        includeTotal: false,
        includeSnapshots: true,
      })
    ).toThrow(/page size cannot exceed/i);
  });

  it('allows snapshots at MAX_SNAPSHOT_LIMIT', () => {
    expect(() =>
      enforceQueryGuardrails({
        requestedAtRange: shortRange,
        limit: MAX_SNAPSHOT_LIMIT,
        includeTotal: false,
        includeSnapshots: true,
      })
    ).not.toThrow();
  });
});

describe('resolveFieldSelection', () => {
  it('returns default columns when select_fields omitted', () => {
    const { responseFields, queryColumns } = resolveFieldSelection(undefined, {});
    expect(responseFields).toContain('merchant_id');
    expect(responseFields).toContain('instagram_page_id');
    expect(queryColumns).toEqual(expect.arrayContaining(['id', 'requested_at']));
  });

  it('adds snapshots when include_snapshots is true (default shape)', () => {
    const { responseFields, includeSnapshots } = resolveFieldSelection(undefined, {
      include_snapshots: true,
    });
    expect(responseFields).toContain('request_snapshot');
    expect(includeSnapshots).toBe(true);
  });

  it('always includes keyset columns in query but not necessarily in response', () => {
    const { responseFields, queryColumns } = resolveFieldSelection(['endpoint'], {});
    expect(responseFields).toEqual(['endpoint']);
    expect(queryColumns).toEqual(
      expect.arrayContaining(['endpoint', 'requested_at', 'id'])
    );
    expect(queryColumns.length).toBe(3);
  });

  it('enables snapshots when snapshot fields are selected', () => {
    const { includeSnapshots, queryColumns } = resolveFieldSelection(
      ['endpoint', 'request_snapshot'],
      {}
    );
    expect(includeSnapshots).toBe(true);
    expect(queryColumns).toContain('request_snapshot');
  });
});

describe('projectRow and cursor', () => {
  it('projects only requested fields', () => {
    const row = {
      id: '66d7952f-7088-4778-8724-98ecc6765a9d',
      endpoint: '/v1/test',
      requested_at: new Date('2026-05-07T10:00:00.000Z'),
      merchant_id: '35221b02-c600-46f7-bcab-549f399c2a8d',
    };
    const projected = projectRow(row, ['endpoint']);
    expect(projected).toEqual({ endpoint: '/v1/test' });
    expect(projected.id).toBeUndefined();
  });

  it('builds cursor from internal row columns not in response', () => {
    const row = {
      endpoint: '/v1/test',
      requested_at: new Date('2026-05-07T10:00:00.000Z'),
      id: '66d7952f-7088-4778-8724-98ecc6765a9d',
    };
    const cursor = buildNextCursor(row);
    expect(cursor).toEqual({
      requested_at: '2026-05-07T10:00:00.000Z',
      id: '66d7952f-7088-4778-8724-98ecc6765a9d',
    });
  });
});

describe('resolveQueryColumns', () => {
  it('deduplicates keyset fields', () => {
    const columns = resolveQueryColumns(['id', 'requested_at', 'endpoint']);
    expect(columns.filter((c) => c === 'id').length).toBe(1);
    expect(columns).toContain('endpoint');
  });
});

describe('SELECTABLE_FIELDS', () => {
  it('does not expose instagram_page_id for explicit selection', () => {
    expect(SELECTABLE_FIELDS.has('instagram_page_id')).toBe(false);
  });
});

describe('GuardrailError', () => {
  it('sets statusCode 400 and GUARDRAIL_VIOLATION code', () => {
    const err = new GuardrailError('test');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ERROR_CODES.GUARDRAIL_VIOLATION);
  });
});
