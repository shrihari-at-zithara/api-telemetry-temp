/**
 * Transaction + timeout wiring for search queries.
 */

const { setExternalQuery, setExternalRunInTransaction } = require('../../src/db/postgres');
const { withStatementTimeout } = require('../../src/db/query-with-timeout');

describe('withStatementTimeout (injected runInTransaction)', () => {
  afterEach(() => {
    setExternalQuery(null);
    setExternalRunInTransaction(null);
  });

  it('uses host runInTransaction and sets statement_timeout', async () => {
    const calls = [];

    setExternalQuery(async (text) => {
      calls.push(['query', text]);
      return { rows: [] };
    });

    setExternalRunInTransaction(async (callback) => {
      const client = {
        query: async (text) => {
          calls.push(['tx', text]);
          return { rows: [] };
        },
      };
      return callback(client);
    });

    await withStatementTimeout(async (client) => {
      await client.query('SELECT 1');
      return { ok: true };
    });

    expect(calls.some(([, text]) => String(text).includes('statement_timeout'))).toBe(true);
    expect(calls).toContainEqual(['tx', 'SELECT 1']);
  });
});
