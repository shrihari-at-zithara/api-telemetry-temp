/**
 * initializeApiTelemetry — single initialization per process.
 */

describe('initializeApiTelemetry', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function load() {
    return {
      initializeApiTelemetry: require('../../src/runtime/initialize').initializeApiTelemetry,
      query: require('../../src/db/postgres').query,
      ConfigurationError: require('../../src/utils/errors').ConfigurationError,
    };
  }

  it('first initialization succeeds (query mode)', () => {
    const { initializeApiTelemetry } = load();
    const queryFn = jest.fn().mockResolvedValue({ rows: [] });
    const runInTransaction = jest.fn(async (cb) => cb({ query: queryFn }));

    const api = initializeApiTelemetry({ query: queryFn, runInTransaction });

    expect(api).toEqual(
      expect.objectContaining({
        logApiCall: expect.any(Function),
        searchApiCallLogs: expect.any(Function),
      })
    );
  });

  it('first initialization succeeds (pool mode)', () => {
    const { initializeApiTelemetry } = load();
    const pool = {
      connect: jest.fn(),
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    const api = initializeApiTelemetry({ pool });

    expect(api.logApiCall).toBeDefined();
  });

  it('rejects initialization with no pool or query', () => {
    const { initializeApiTelemetry, ConfigurationError } = load();

    expect(() => initializeApiTelemetry()).toThrow(ConfigurationError);
    expect(() => initializeApiTelemetry()).toThrow(/provide either \{ pool \} or \{ query \}/i);
  });

  it('second initialization throws ConfigurationError', () => {
    const { initializeApiTelemetry, ConfigurationError } = load();
    initializeApiTelemetry({ query: jest.fn() });

    expect(() => initializeApiTelemetry({ query: jest.fn() })).toThrow(ConfigurationError);
    expect(() => initializeApiTelemetry({ query: jest.fn() })).toThrow(
      /already been called/i
    );
  });

  it('does not mutate postgres state when second initialization fails (query mode)', async () => {
    const { initializeApiTelemetry, query, ConfigurationError } = load();
    const firstQuery = jest.fn().mockResolvedValue({ rows: [{ marker: 'first' }] });
    const secondQuery = jest.fn().mockResolvedValue({ rows: [{ marker: 'second' }] });

    initializeApiTelemetry({ query: firstQuery });

    expect(() => initializeApiTelemetry({ query: secondQuery })).toThrow(ConfigurationError);

    const result = await query('SELECT 1');
    expect(result.rows[0].marker).toBe('first');
    expect(firstQuery).toHaveBeenCalled();
    expect(secondQuery).not.toHaveBeenCalled();
  });

  it('does not mutate postgres state when second initialization fails (pool mode)', async () => {
    const { initializeApiTelemetry, query, ConfigurationError } = load();
    const firstPool = {
      connect: jest.fn(),
      query: jest.fn().mockResolvedValue({ rows: [{ marker: 'first-pool' }] }),
    };
    const secondPool = {
      connect: jest.fn(),
      query: jest.fn().mockResolvedValue({ rows: [{ marker: 'second-pool' }] }),
    };

    initializeApiTelemetry({ pool: firstPool });

    expect(() => initializeApiTelemetry({ pool: secondPool })).toThrow(ConfigurationError);

    const result = await query('SELECT 1');
    expect(result.rows[0].marker).toBe('first-pool');
    expect(firstPool.query).toHaveBeenCalled();
    expect(secondPool.query).not.toHaveBeenCalled();
  });

  it('allows initialization after first call fails validation', () => {
    const { initializeApiTelemetry, ConfigurationError } = load();
    const badPool = { query: jest.fn() };

    expect(() => initializeApiTelemetry({ pool: badPool })).toThrow(ConfigurationError);

    const queryFn = jest.fn().mockResolvedValue({ rows: [] });
    expect(() => initializeApiTelemetry({ query: queryFn })).not.toThrow();
  });
});
