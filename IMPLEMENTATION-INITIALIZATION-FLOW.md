# API Telemetry Library — Initialization & Database Execution Flow

Source-only analysis of `api-telemetry-temp/`. Every step cites actual files and call chains.

---

## Sequence diagram (end-to-end)

```
initializeApiTelemetry(options)
    ↓
src/runtime/initialize.js
    ├─ validations (pool+query mutual exclusion, pool.connect)
    └─ setExternalPool | setExternalQuery [+ setExternalRunInTransaction]
           ↓
    src/db/postgres.js module-level variables
    (externalPool | externalQuery + externalRunInTransaction)
           ↓
    initialized = true  (initialize.js only; not checked on read/write paths)

── Search ──

searchApiCallLogs(body)
    ↓
validateSearchPayload → normalizeFilters → resolveFieldSelection → enforceQueryGuardrails
    ↓
listApiCallLogs / countApiCallLogs  (src/search/repository.js)
    ↓
withStatementTimeout(callback)  (src/db/query-with-timeout.js)
    ↓
runInTransaction(callback)  (src/db/postgres.js)
    ├─ [query mode] externalRunInTransaction(callback)  → host SQL (e.g. Sequelize transaction)
    └─ [pool mode]  pool.connect() → BEGIN → callback(client) → COMMIT → client.release()
           ↓
    client.query(`SET LOCAL statement_timeout = '…'`)
    client.query(SELECT … FROM api_call_logs …)
           ↓
    PostgreSQL

── Write ──

logApiCall(payload)
    ↓
assertValidApiCallLog → normalizeApiCallLog
    ↓
insertApiCallLog(record)  (src/repositories/api-call-log.repository.js)
    ↓
query(INSERT_SQL, params)  (src/db/postgres.js)
    ├─ [query mode] externalQuery(text, params)
    └─ [pool mode]  getPool().query(text, params)
           ↓
    PostgreSQL
```

---

## 1. `initializeApiTelemetry()`

### File

`src/runtime/initialize.js`

### Complete execution flow

| Step | Lines | What happens | Next |
|------|-------|--------------|------|
| 1 | 45–46 | Destructure `options`: `pool`, `query`, `runInTransaction` | — |
| 2 | 48–50 | If **both** `pool` and `query` are truthy → throw `ConfigurationError` | (stops) |
| 3 | 52–56 | If `pool` is truthy: require `typeof pool.connect === 'function'`, else `ConfigurationError`; call `setExternalPool(ensureDependency('pool', pool))` | `postgres.setExternalPool` |
| 4 | 57–61 | Else if `query` is truthy: `setExternalQuery(ensureDependency('query', query))`; if `runInTransaction` truthy → `setExternalRunInTransaction(ensureDependency(...))` | `postgres.setExternalQuery` / `setExternalRunInTransaction` |
| 5 | 62 | If neither `pool` nor `query`: **no** `postgres.js` setters run | — |
| 6 | 64 | `initialized = true` | — |
| 7 | 66 | Return `{ logApiCall, searchApiCallLogs }` (same function references as module imports) | — |

### Source

```45:67:api-telemetry-temp/src/runtime/initialize.js
const initializeApiTelemetry = (options = {}) => {
  const { pool, query, runInTransaction } = options;

  if (pool && query) {
    throw new ConfigurationError(MESSAGES.db.initPoolOrQuery());
  }

  if (pool) {
    if (typeof pool.connect !== 'function') {
      throw new ConfigurationError(MESSAGES.db.poolConnectRequired());
    }
    setExternalPool(ensureDependency('pool', pool));
  } else if (query) {
    setExternalQuery(ensureDependency('query', query));
    if (runInTransaction) {
      setExternalRunInTransaction(ensureDependency('runInTransaction', runInTransaction));
    }
  }

  initialized = true;

  return { logApiCall, searchApiCallLogs };
};
```

### Validations performed

| Check | Condition | Error |
|-------|-----------|-------|
| Mutual exclusion | `pool && query` | `ConfigurationError` — `MESSAGES.db.initPoolOrQuery()` |
| Native pg pool | `pool` set and `typeof pool.connect !== 'function'` | `ConfigurationError` — `MESSAGES.db.poolConnectRequired()` |
| Required `pool` in pool branch | `ensureDependency('pool', pool)` — falsy `pool` never enters branch | `Error: 'pool is required'` |
| Required `query` in query branch | `ensureDependency('query', query)` | `Error: 'query is required'` |
| Required `runInTransaction` when provided | only if `runInTransaction` option is truthy | `Error: 'runInTransaction is required'` |

`ensureDependency`:

```23:28:api-telemetry-temp/src/runtime/initialize.js
const ensureDependency = (name, value) => {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};
```

### What is stored internally

`initializeApiTelemetry` does **not** store a single runtime object. It:

1. Sets module-level variables in `src/db/postgres.js` via setters (see §2).
2. Sets `initialized = true` in `initialize.js` (a separate `let initialized` boolean).

Returned value is only `{ logApiCall, searchApiCallLogs }` — not a handle to DB state.

### Public export

Re-exported from `src/index.js`:

```13:13:api-telemetry-temp/src/index.js
const { initializeApiTelemetry } = require('./runtime/initialize');
```

---

## 2. Runtime storage

### Where state lives

| State | Module | Variable(s) |
|-------|--------|-------------|
| “Was init called?” | `src/runtime/initialize.js` | `let initialized = false` |
| DB access mode | `src/db/postgres.js` | `externalPool`, `externalQuery`, `externalRunInTransaction` |

### `postgres.js` module-level storage

```12:26:api-telemetry-temp/src/db/postgres.js
/** @type {import('pg').Pool | null} */
/** @type {import('pg').Pool | null} */
let externalPool = null;

/** @type {((text: string, params?: unknown[]) => Promise<import('pg').QueryResult>) | null} */
let externalQuery = null;

/** @type {RunInTransactionFn | null} */
let externalRunInTransaction = null;
```

### How it is shared

- Any file that `require('../db/postgres')` reads the **same** Node.js module singleton.
- Search: `repository.js` → `query-with-timeout.js` → `postgres.runInTransaction`
- Write: `api-call-log.repository.js` → `postgres.query`

There is no `getRuntime()`, `getDb()`, or passed context object.

### Module-scoped singleton?

**Yes.** One copy of `postgres.js` and `initialize.js` per process. All consumers share the same `externalPool` / `externalQuery` / `externalRunInTransaction` values.

### Setter side effects (mode switching)

```33:57:api-telemetry-temp/src/db/postgres.js
function setExternalPool(pool) {
  externalPool = pool;
  externalQuery = null;
  externalRunInTransaction = null;
}

function setExternalQuery(queryFn) {
  externalQuery = queryFn;
  externalPool = null;
}

function setExternalRunInTransaction(fn) {
  externalRunInTransaction = fn;
}
```

Note: `setExternalQuery` does **not** clear `externalRunInTransaction`. `initializeApiTelemetry` only calls `setExternalRunInTransaction` when `runInTransaction` is passed; it does not clear a previous `externalRunInTransaction` when omitting that option.

---

## 3. Initialization modes — decision tree

### Actual condition checks (in order)

```
options = { pool, query, runInTransaction }

1. IF pool AND query (both truthy)
     → throw ConfigurationError

2. ELSE IF pool (truthy)
     → IF typeof pool.connect !== 'function'
          → throw ConfigurationError
     → setExternalPool(pool)
     → externalQuery = null, externalRunInTransaction = null (inside setter)

3. ELSE IF query (truthy)
     → setExternalQuery(query)
     → externalPool = null (inside setter)
     → IF runInTransaction (truthy)
          → setExternalRunInTransaction(runInTransaction)

4. ELSE (no pool, no query)
     → throw ConfigurationError (initRequiresPoolOrQuery)

5. ALWAYS: initialized = true (only after steps 2–3 succeed)
```

### Mode persistence (implicit, not a stored enum)

The library does not store `"mode": "pool" | "query"`. Mode is inferred at runtime:

| After init | `externalPool` | `externalQuery` | `externalRunInTransaction` | Write path | Search transaction path |
|------------|----------------|-----------------|----------------------------|------------|-------------------------|
| `{ pool }` | host Pool | `null` | `null` | `getPool().query` | `getPool().connect()` + BEGIN/COMMIT |
| `{ query, runInTransaction }` | `null` | host fn | host fn | `externalQuery(...)` | `externalRunInTransaction(...)` |
| `{ query }` only | `null` | host fn | unchanged / `null` | `externalQuery(...)` | `getPool()` or error if no connect |
| omitted / invalid | — | — | — | init throws | init throws |

### Example host wiring (admin panel — outside package, for reference)

`admin-panel-backend/bootstrap/api-telemetry.js` calls:

```68:68:admin-panel-backend/bootstrap/api-telemetry.js
  return initializeApiTelemetry({ query, runInTransaction });
```

with Sequelize-backed `query` and `runInTransaction` built in that file (not part of the library package).

---

## 4. Runtime retrieval

### Functions that read DB runtime state

| Function | File | Reads |
|----------|------|-------|
| `query()` | `postgres.js` | `externalQuery`, else `getPool()` → `pool.query` |
| `runInTransaction()` | `postgres.js` | `externalRunInTransaction`, else `getPool().connect()` |
| `getPool()` | `postgres.js` | `externalPool`, else creates `ownedPool` |
### Call chains that reach runtime

**Write**

```
logApiCall
  → api-call-log.repository.insertApiCallLog
    → postgres.query
```

**Search**

```
searchApiCallLogs
  → repository.listApiCallLogs | countApiCallLogs
    → withStatementTimeout
      → postgres.runInTransaction
```

---

Second call to `initializeApiTelemetry` throws `ConfigurationError` before any postgres setter runs.

---

## 5. Search flow — `searchApiCallLogs()` to PostgreSQL

### Step-by-step

| # | File | Function | Action | Next |
|---|------|----------|--------|------|
| 1 | `src/search/service.js` | `searchApiCallLogs` | Entry | `validateSearchPayload` |
| 2 | `src/search/validate-payload.js` | `validateSearchPayload` | Joi validation | return to service |
| 3 | `src/search/service.js` | `normalizeFilters` | Date range, HTTP method uppercasing | `resolveFieldSelection` |
| 4 | `src/search/select-fields.js` | `resolveFieldSelection` | Columns for SELECT / response projection | `enforceQueryGuardrails` |
| 5 | `src/search/guardrails.js` | `enforceQueryGuardrails` | Range/limit/snapshot rules | `listApiCallLogs` |
| 6 | `src/search/repository.js` | `listApiCallLogs` | Build SQL + params | `withStatementTimeout` |
| 7 | `src/db/query-with-timeout.js` | `withStatementTimeout` | Wrap in transaction + timeout | `runInTransaction` |
| 8 | `src/db/postgres.js` | `runInTransaction` | Host tx or `pool.connect` | `client.query` |
| 9 | (inside callback) | `client.query` | `SET LOCAL statement_timeout`, then SELECT | PostgreSQL |

Optional total:

| # | File | Function | Next |
|---|------|----------|------|
| 10 | `src/search/service.js` | `countApiCallLogs` if `include_total` | same `withStatementTimeout` chain |

### `listApiCallLogs` → SQL execution

```81:84:api-telemetry-temp/src/search/repository.js
  const rows = await withStatementTimeout(async (client) => {
    const result = await client.query(sql, builder.params);
    return result.rows;
  });
```

### Runtime access in search

```40:47:api-telemetry-temp/src/db/query-with-timeout.js
async function withStatementTimeout(callback) {
  const { statementTimeout } = telemetryConfig.search;

  try {
    return await runInTransaction(async (client) => {
      await client.query(`SET LOCAL statement_timeout = '${statementTimeout}'`);
      return callback(client);
    });
```

```115:137:api-telemetry-temp/src/db/postgres.js
async function runInTransaction(callback) {
  if (externalRunInTransaction) {
    return externalRunInTransaction(callback);
  }

  const pool = getPool();
  if (typeof pool.connect !== 'function') {
    throw new ConfigurationError(MESSAGES.db.transactionRequired());
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
```

### Pool vs `query`/`runInTransaction` for search

- Search **always** uses `runInTransaction` (via `withStatementTimeout`), never `postgres.query()` directly.
- **First branch:** if `externalRunInTransaction` is set → host runs the transaction; host must supply `client.query` on the callback argument.
- **Else:** `getPool()` then `pool.connect()` + BEGIN/COMMIT/ROLLBACK.
- Writes inside search use the **transaction `client`**, not `postgres.query()`.

---

## 6. Write flow — `logApiCall()` to INSERT

| # | File | Function | Action | Next |
|---|------|----------|--------|------|
| 1 | `src/services/api-call-log.service.js` | `logApiCall` | try/catch wrapper | `assertValidApiCallLog` |
| 2 | `src/validators/api-call-log.validator.js` | `assertValidApiCallLog` | validation | `normalizeApiCallLog` |
| 3 | same | `normalizeApiCallLog` | normalize record | `insertApiCallLog` |
| 4 | `src/repositories/api-call-log.repository.js` | `insertApiCallLog` | build params, `query(INSERT_SQL, params)` | `postgres.query` |
| 5 | `src/db/postgres.js` | `query` | route to host or pool | PostgreSQL |

### INSERT execution

```67:68:api-telemetry-temp/src/repositories/api-call-log.repository.js
  try {
    const result = await query(INSERT_SQL, params);
```

```95:106:api-telemetry-temp/src/db/postgres.js
async function query(text, params) {
  if (externalQuery) {
    return externalQuery(text, params);
  }

  const pool = getPool();
  if (typeof pool.query === 'function') {
    return pool.query(text, params);
  }

  throw new ConfigurationError(MESSAGES.db.poolRequired());
}
```

### Runtime access on write

- Write path uses **`query()` only** — no transaction wrapper in the library.
- If `{ query }` mode: `externalQuery(text, params)` (e.g. Sequelize without transaction).
- If `{ pool }` mode or lazy pool: `getPool().query(text, params)`.

---

## 7. Database adapter layer

There is **no** `getDb()`, `getRuntime()`, repository factory, or adapter class.

The normalization layer is **`src/db/postgres.js`** with two exported primitives:

| Primitive | Used by | Normalizes |
|-----------|---------|------------|
| `query(text, params)` | Write (`insertApiCallLog`) | `externalQuery` **or** `pool.query` |
| `runInTransaction(callback)` | Search (`withStatementTimeout`) | `externalRunInTransaction` **or** `pool.connect` + BEGIN/COMMIT |

### Exported surface from `postgres.js`

```javascript
module.exports = {
  query,
  getPool,
  runInTransaction,
  setExternalPool,
  setExternalQuery,
  setExternalRunInTransaction,
};
```

`getPool()` returns `externalPool` or throws if the library was initialized in query-only mode.

Setters are only called from `initialize.js` (and tests that import setters directly).

---

## 8. Transactions

### `runInTransaction` usage

| Location | Usage |
|----------|--------|
| `src/db/query-with-timeout.js` | Only caller of `runInTransaction` in the package |
| `src/search/repository.js` | Calls `withStatementTimeout` for list + count |

### `pool.connect()` usage

Only inside `postgres.runInTransaction` when `externalRunInTransaction` is **null**:

```125:136:api-telemetry-temp/src/db/postgres.js
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
```

### Behavior difference between modes

| Aspect | Pool mode | Query + `runInTransaction` mode |
|--------|-----------|-----------------------------------|
| Who opens transaction | Library: `connect`, `BEGIN`, `COMMIT`/`ROLLBACK`, `release` | Host `externalRunInTransaction` |
| `client` in search callback | pg `PoolClient` from `connect()` | Host-defined object; must implement `.query` |
| `SET LOCAL statement_timeout` | Executed on that client inside host or pg transaction | Same SQL string; runs on host’s transactional connection |
| Writes (`logApiCall`) | **No** library transaction; single `query()` | **No** library transaction; host `query` without tx unless host wraps externally |

Search requires a transactional session so `SET LOCAL statement_timeout` applies to the following SELECT. Writes do not use `runInTransaction` in this codebase.

---

## 9. State persistence after init

### What is remembered

1. **`initialized === true`** in `initialize.js` (internal only; not exported).
2. **Implicit DB mode** via non-null module variables in `postgres.js`.

### There is no runtime object shape

The library does not assign:

```js
runtime = { mode: 'pool', pool: ... }  // does not exist
```

### Effective state examples

**After `initializeApiTelemetry({ pool: pgPool })`:**

```js
// initialize.js
initialized === true

// postgres.js
externalPool === pgPool
externalQuery === null
externalRunInTransaction === null
```

**After `initializeApiTelemetry({ query: fn, runInTransaction: txFn })`:**

```js
initialized === true

externalPool === null
externalQuery === fn
externalRunInTransaction === txFn
```

---

## 10. Per-step reference tables

### Initialization

| Step | Source | Code does | Next |
|------|--------|-----------|------|
| Entry | `runtime/initialize.js:45` | Parse options | mutual exclusion check |
| Validate both | `runtime/initialize.js:48-50` | Reject pool+query | — or pool branch |
| Pool branch | `runtime/initialize.js:52-56` | Check `.connect`, `setExternalPool` | `postgres.js:33-37` |
| Query branch | `runtime/initialize.js:57-61` | `setExternalQuery`, optional `setExternalRunInTransaction` | `postgres.js:44-57` |
| Flag | `runtime/initialize.js:64` | `initialized = true` | return API |

### Search (compact)

| Step | Source | Next |
|------|--------|------|
| `searchApiCallLogs` | `search/service.js:66` | `validateSearchPayload` |
| `validateSearchPayload` | `search/validate-payload.js` | service |
| `listApiCallLogs` | `search/repository.js:46` | `withStatementTimeout` |
| `withStatementTimeout` | `db/query-with-timeout.js:40` | `runInTransaction` |
| `runInTransaction` | `db/postgres.js:115` | `client.query` → PostgreSQL |

### Write (compact)

| Step | Source | Next |
|------|--------|------|
| `logApiCall` | `services/api-call-log.service.js:22` | validator |
| `insertApiCallLog` | `repositories/api-call-log.repository.js:45` | `query` |
| `query` | `db/postgres.js:95` | PostgreSQL |

---

## Files involved (index)

| Concern | Path |
|---------|------|
| Init entry | `src/runtime/initialize.js` |
| DB singleton / routing | `src/db/postgres.js` |
| Search timeout + tx | `src/db/query-with-timeout.js` |
| Search orchestration | `src/search/service.js` |
| Search SQL | `src/search/repository.js` |
| Write orchestration | `src/services/api-call-log.service.js` |
| Write SQL | `src/repositories/api-call-log.repository.js` |
| Public exports | `src/index.js` |

---

## Facts that are not in the code

- No check that `initializeApiTelemetry` was called before `searchApiCallLogs` / `logApiCall` (DB calls fail via `postgres.query` / `runInTransaction` if not wired).
- No stored reference to the original `options` object after init returns.
- No library-owned lazy pool; hosts must pass `{ pool }` or `{ query }` at init.
