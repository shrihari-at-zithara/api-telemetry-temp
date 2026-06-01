# @zithara/api-telemetry-lib

Node.js library for recording outbound API calls to PostgreSQL (`api_call_logs`) and querying those records from admin or internal tools.

Used by campaign-backend (writes), admin-panel-backend (search UI), and other services that need a shared schema and query contract.

## Documentation

| Resource | Description |
|----------|-------------|
| This README — [Search API](#search-api-searchapiloglogs) | Library search request/response, filters, pagination |
| [sql/create-api-call-logs.sql](sql/create-api-call-logs.sql) | Table DDL |
| [sql/indexes-api-call-logs.sql](sql/indexes-api-call-logs.sql) | Indexes for list/search queries |
| [admin-panel-backend/docs/api-call-logs-search.md](../admin-panel-backend/docs/api-call-logs-search.md) | HTTP wrapper: `POST /api/v1/api-call-logs/search` (auth, envelope) |

## What the library provides

| Capability | Function | Description |
|------------|----------|-------------|
| Bootstrap | `initializeApiTelemetry(options)` | Connect to PostgreSQL via host `pool`, or `query` + `runInTransaction` (Sequelize) |
| Write | `logApiCall(payload)` | Validate and insert one `api_call_logs` row |
| Read | `searchApiCallLogs(body)` | Filtered, keyset-paginated search with guardrails |
| Validate only | `validateSearchPayload(body)` | Joi validation for custom HTTP handlers |
| Snapshots | `buildRequestSnapshot`, `buildResponseSnapshot*`, `buildRequestSnapshotFromAxiosConfig` | Build redacted JSONB for request/response capture |
| Config | `telemetryConfig`, `TELEMETRY_DEFAULTS` | Runtime limits |
| Errors | `SearchValidationError`, `GuardrailError`, `QueryTimeoutError`, … | Typed errors with `code` and `statusCode` |
| HTTP helpers | `mapTelemetryError`, `isTelemetryClientError` | Map errors for APIs |

Internal modules (repositories, SQL builders) are not exported.

## Requirements

- Node.js 20+
- PostgreSQL with `api_call_logs` (see [Database schema](#database-schema))
- CommonJS (`require` / `module.exports`)

## Installation

Monorepo (local path):

```bash
npm install file:../api-telemetry-temp
```

Published package:

```bash
npm install @zithara/api-telemetry-lib
```

## Configuration

Hosts must call `initializeApiTelemetry` with `{ pool }` or `{ query, runInTransaction }` once at startup.

| Variable | Description |
| -------- | ----------- |
| `DATABASE_URL` or `POSTGRES_URI` | Connection string |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Alternative to URL |
| `PG_POOL_MAX` | Pool size (default `10`) |
| `PG_POOL_IDLE_TIMEOUT_MS` | Idle timeout (default `30000`) |
| `PG_POOL_CONNECTION_TIMEOUT_MS` | Connect timeout (default `5000`) |
| `API_TELEMETRY_LOG_LEVEL` | `error` \| `warn` \| `info` \| `debug` |
| `API_CALL_LOG_QUERY_TIMEOUT_MS` | Search query timeout in ms (default `10000`) |
| `API_TELEMETRY_SEARCH_DEFAULT_LIMIT` | Default page size (default `50`) |
| `API_TELEMETRY_SEARCH_MAX_LIMIT` | Max page size (default `100`) |
| `API_TELEMETRY_SEARCH_MAX_RANGE_DAYS` | Max `requested_at` span (default `31`) |
| `API_TELEMETRY_SEARCH_MAX_TOTAL_RANGE_DAYS` | Max span when `include_total` is true (default `7`) |
| `API_TELEMETRY_SEARCH_MAX_SNAPSHOT_LIMIT` | Max `limit` when snapshots are included (default `25`) |

### Limits file (`src/config/telemetry.config.js`)

Edit **`TELEMETRY_DEFAULTS`** in `src/config/telemetry.config.js` to change limits in code. At runtime, values are available as `telemetryConfig` (exported from the package). Env vars above override defaults without code changes.

### Invalid payloads

Unknown attributes are rejected before SQL runs. There is **no default date range**.

| Invalid input | Error | HTTP | `code` |
|---------------|-------|------|--------|
| Unknown top-level or filter key | `SearchValidationError` | 400 | `SEARCH_VALIDATION_ERROR` |
| `select_fields` not allow-listed | `SearchValidationError` | 400 | `SEARCH_VALIDATION_ERROR` |
| `pagination.limit` too large | `SearchValidationError` | 400 | `SEARCH_VALIDATION_ERROR` |
| Missing / invalid `requested_at` | `SearchValidationError` or `GuardrailError` | 400 | see above |
| Date range too wide | `GuardrailError` | 400 | `GUARDRAIL_VIOLATION` |
| `include_total` / snapshots guardrails | `GuardrailError` | 400 | `GUARDRAIL_VIOLATION` |
| Query timeout | `QueryTimeoutError` | 503 | `QUERY_TIMEOUT` |
| Invalid `logApiCall` body | `ValidationError` | 400 | `VALIDATION_ERROR` |

Use `mapTelemetryError(err)` in Express handlers for consistent responses.

Apply DDL and indexes:

```bash
psql "$DATABASE_URL" -f sql/create-api-call-logs.sql
psql "$DATABASE_URL" -f sql/indexes-api-call-logs.sql
```

## How to use

### 1. Bootstrap (exactly once at startup)

Call `initializeApiTelemetry` once per process. A second call throws `ConfigurationError`. Reuse the host database connection when possible.

**Native `pg` Pool** (e.g. campaign-backend):

```javascript
const { initializeApiTelemetry } = require('@zithara/api-telemetry-lib');
const db = require('./api/services/queryService');

initializeApiTelemetry({ pool: db.pool }); // must implement pool.connect()
```

**Sequelize** (admin-panel — `sequelize.connectionManager.pool` is not a `pg` Pool):

```javascript
const { initializeApiTelemetry } = require('@zithara/api-telemetry-lib');
// See admin-panel-backend/bootstrap/api-telemetry.js
initializeApiTelemetry({ query, runInTransaction });
```

| Option | Use when |
|--------|----------|
| `{ pool }` | Host exposes a `pg` Pool with `.connect()` and `.query()` |
| `{ query, runInTransaction }` | Host uses Sequelize or another client; search needs a real transaction for `SET LOCAL statement_timeout` |

Campaign-backend outbound logging: [`campaign-backend/docs/api-telemetry-integration.md`](../campaign-backend/docs/api-telemetry-integration.md).

### 2. Log an outbound API call

Call `logApiCall` after the HTTP client finishes (typically in `finally`), so both success and failure are recorded.

Required fields: `merchant_id`, `endpoint`, `http_method`, `response_time_ms`, `platform`, `api_provider`, `success`.

```javascript
const {
  logApiCall,
  buildRequestSnapshotFromAxiosConfig,
} = require('@zithara/api-telemetry-lib');

const startedAt = Date.now();
let response;
let error;

try {
  response = await axios(axiosConfig);
  return response.data;
} catch (err) {
  error = err;
  throw err;
} finally {
  await logApiCall({
    merchant_id: merchantId,
    endpoint: '/v21.0/me/messages',
    http_method: 'POST',
    response_time_ms: Date.now() - startedAt,
    platform: 'instagram',
    api_provider: 'meta',
    success: !error,
    http_status: response?.status ?? error?.response?.status,
    request: buildRequestSnapshotFromAxiosConfig(axiosConfig),
    ...(response ? { response } : { error }),
  });
}
```

Returns `{ id, requested_at }`. Throws `ValidationError` or `DatabaseError` on failure.

To avoid blocking the caller on logging errors:

```javascript
async function safeLogApiCall(payload) {
  try {
    await logApiCall(payload);
  } catch (err) {
    console.error('telemetry_log_failed', { code: err.code, message: err.message });
  }
}
```

### 3. Search logs

Call `searchApiCallLogs(body)` after bootstrap. Requires `initializeApiTelemetry({ pool })` or `{ query, runInTransaction }` (Sequelize — see `admin-panel-backend/bootstrap/api-telemetry.js`).

```javascript
const { searchApiCallLogs, mapTelemetryError } = require('@zithara/api-telemetry-lib');

try {
  const result = await searchApiCallLogs({
    filters: {
      requested_at: { date_from: '2026-05-26', date_to: '2026-06-01' },
      merchant_id: '35221b02-c600-46f7-bcab-549f399c2a8d',
    },
    select_fields: ['id', 'merchant_id', 'endpoint', 'http_status', 'requested_at'],
    pagination: { limit: 50 },
    options: { include_total: true },
  });
} catch (err) {
  const mapped = mapTelemetryError(err);
  // mapped.statusCode, mapped.message, mapped.error (UI-friendly)
}
```

Admin HTTP endpoint: `POST /api/v1/api-call-logs/search` — see [admin-panel-backend/docs/api-call-logs-search.md](../admin-panel-backend/docs/api-call-logs-search.md).

## Search API (`searchApiCallLogs`)

Library function: `searchApiCallLogs(body)`. Search uses `src/search/` and `src/db/query-with-timeout.js` (transaction + `SET LOCAL statement_timeout`).

### Return shape

```json
{
  "items": [],
  "pagination": {
    "limit": 50,
    "has_more": false,
    "next_cursor": null
  },
  "meta": { "total": 12840 }
}
```

- `meta` is present only when `options.include_total` is `true`.
- `next_cursor` is `null` when `has_more` is `false`.
- `next_cursor` always includes `requested_at` (ISO string) and `id` (UUID), even when omitted from `items` via `select_fields`.

### Request body

```json
{
  "filters": {
    "requested_at": {
      "from": "2026-05-01T00:00:00.000Z",
      "to": "2026-05-08T00:00:00.000Z"
    }
  },
  "select_fields": ["id", "endpoint", "requested_at"],
  "pagination": { "limit": 50, "cursor": null },
  "sort": { "field": "requested_at", "order": "desc" },
  "options": { "include_snapshots": false, "include_total": false }
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `filters` | Yes | — | ANDed constraints; see [Filters](#filters) |
| `select_fields` | No | default column set | Allow-listed columns; see [Select fields](#select-fields) |
| `pagination.limit` | No | `50` | Integer `1`–`100` |
| `pagination.cursor` | No | `null` | Keyset cursor from prior `next_cursor` |
| `sort.field` | No | `requested_at` | Only `requested_at` supported |
| `sort.order` | No | `desc` | `asc` or `desc` |
| `options.include_snapshots` | No | `false` | Add snapshot JSONB to default column set |
| `options.include_total` | No | `false` | Run `COUNT(*)` (guardrailed) |

Unknown keys under `filters` or at the top level are rejected (Joi `unknown(false)`).

Validation: `src/search/validate-payload.js` (Joi). Business guardrails: `src/search/guardrails.js`. Date normalization: `src/search/date-range.js`.

### Full example (date-only range + `include_total`)

Typical admin-panel search body:

```json
{
  "filters": {
    "requested_at": {
      "date_from": "2026-05-26",
      "date_to": "2026-06-01"
    }
  },
  "select_fields": [
    "id",
    "merchant_id",
    "platform",
    "api_provider",
    "endpoint",
    "endpoint_group",
    "http_method",
    "http_status",
    "success",
    "response_time_ms",
    "error_code",
    "requested_at"
  ],
  "pagination": { "limit": 100 },
  "sort": { "field": "requested_at", "order": "desc" },
  "options": { "include_snapshots": false, "include_total": true }
}
```

| Input | Resolved behavior |
|-------|-------------------|
| `date_from` / `date_to` only | `from` = `2026-05-26T00:00:00.000Z`; `to` = start of **next** UTC day after `date_to` (exclusive upper bound). Rows on **2026-05-26 through 2026-06-01** (inclusive calendar days) match. |
| `select_fields` | Response `items` contain only listed columns. |
| `pagination.limit` | `100` (= `MAX_LIMIT` from `telemetryConfig`). |
| `include_total: true` | `meta.total` only when span ≤ **7 days** (`MAX_TOTAL_COUNT_RANGE_DAYS`). |

Optional filters (ANDed with the date range):

```json
"merchant_id": "35221b02-c600-46f7-bcab-549f399c2a8d",
"platform": "instagram",
"api_provider": "meta",
"success": false
```

Use channel names (`instagram`, `facebook`, `whatsapp`, `internal`) for `platform`. Use `meta` under `api_provider` for Meta Graph API — not as `platform`. See [Suggested platform vs api_provider](#suggested-platform-vs-api_provider).

### No default date range

There is **no** implicit `requested_at` window. Clients must send an explicit range.

| Scenario | Result |
|----------|--------|
| `filters` omitted | **400** — `SearchValidationError` |
| `filters` without `requested_at` | **400** — `SearchValidationError` |
| `requested_at: {}` | **400** — missing `from`/`date_from` and `to`/`date_to` |
| Range wider than 31 days | **400** — `GuardrailError` |
| `include_total: true` and range > 7 days | **400** — `GuardrailError` |

**Defaults when omitted (not dates):** `pagination.limit` = 50, `sort.order` = `desc`, `options.include_total` = false, `options.include_snapshots` = false; `select_fields` omitted → full default columns (includes `instagram_page_id`).

### Search guardrails

Limits: `src/config/telemetry.config.js` (`TELEMETRY_DEFAULTS`). Env overrides listed in [Configuration](#configuration).

| Constant | Default | Env override |
|----------|---------|----------------|
| `DEFAULT_LIMIT` | 50 | `API_TELEMETRY_SEARCH_DEFAULT_LIMIT` |
| `MAX_LIMIT` | 100 | `API_TELEMETRY_SEARCH_MAX_LIMIT` |
| `MAX_RANGE_DAYS` | 31 | `API_TELEMETRY_SEARCH_MAX_RANGE_DAYS` |
| `MAX_TOTAL_COUNT_RANGE_DAYS` | 7 | `API_TELEMETRY_SEARCH_MAX_TOTAL_RANGE_DAYS` |
| `MAX_SNAPSHOT_LIMIT` | 25 | `API_TELEMETRY_SEARCH_MAX_SNAPSHOT_LIMIT` |
| `QUERY_TIMEOUT_MS` | 10000 | `API_CALL_LOG_QUERY_TIMEOUT_MS` |

| Rule | Behavior |
|------|----------|
| Date range | `filters.requested_at` required; span ≤ 31 days; `from < to` |
| `include_total` | Only if range ≤ 7 days |
| Snapshots + limit | If snapshots included, `limit` ≤ 25 |
| Query timeout | `SET LOCAL statement_timeout`; overrun → `QueryTimeoutError` (503) |

### Filters

Registry: `src/search/filters.js` (`FILTER_REGISTRY`). All filters are **AND**ed. Parameterized SQL only.

#### `requested_at` (required)

Half-open interval: `requested_at >= from` AND `requested_at < to`.

**ISO:**

```json
"requested_at": {
  "from": "2026-05-01T00:00:00.000Z",
  "to": "2026-05-08T00:00:00.000Z"
}
```

**Date + optional time (UTC):**

```json
"requested_at": {
  "date_from": "2026-05-01",
  "date_to": "2026-05-07",
  "time_from": "09:00",
  "time_to": "17:30"
}
```

| Sub-field | Notes |
|-----------|--------|
| `date_from` / `date_to` | `YYYY-MM-DD` |
| `time_from` / `time_to` | `HH:mm` or `HH:mm:ss`; UTC |
| Date-only `date_to` | Upper bound = start of **next** UTC day |
| `date_to` + `time_to` | Upper bound = that UTC instant (exclusive) |

#### Other filters (optional)

Single value or array → SQL `= ANY(...)`.

| Key | Column | Type |
|-----|--------|------|
| `merchant_id` | `merchant_id` | UUID |
| `user_id` | `user_id` | integer (`bigint`) |
| `platform` | `platform` | text |
| `api_provider` | `api_provider` | text |
| `endpoint` | `endpoint` | text |
| `endpoint_group` | `endpoint_group` | text |
| `http_method` | `http_method` | enum (uppercased) |
| `http_status` | `http_status` | 100–599 |
| `success` | `success` | boolean |

### Select fields

Logic: `src/search/select-fields.js`.

When `select_fields` is omitted, the default set includes `instagram_page_id`.

**Allow-listed:** `id`, `merchant_id`, `user_id`, `platform`, `api_provider`, `endpoint`, `endpoint_group`, `http_method`, `http_status`, `success`, `response_time_ms`, `error_code`, `error_message`, `request_id`, `trace_id`, `requested_at`, `request_snapshot`, `response_snapshot`.

`instagram_page_id` is default-only — not selectable via `select_fields`. Keyset columns `requested_at` and `id` are always queried but omitted from `items` unless listed.

### Pagination

Keyset on `(requested_at, id)` — no `OFFSET`. Repository: `src/search/repository.js`.

**First page:** `{ "pagination": { "limit": 50 } }`

**Next page:** use `next_cursor` from the previous response:

```json
{
  "pagination": {
    "limit": 50,
    "cursor": {
      "requested_at": "2026-05-07T10:15:30.123Z",
      "id": "66d7952f-7088-4778-8724-98ecc6765a9d"
    }
  }
}
```

`cursor` must match `sort.order` (`desc` = older than cursor; `asc` = newer).

### Search errors (HTTP adapters)

| Situation | Error type | HTTP | `code` |
|-----------|------------|------|--------|
| Joi / schema | `SearchValidationError` | 400 | `SEARCH_VALIDATION_ERROR` |
| Guardrails | `GuardrailError` | 400 | `GUARDRAIL_VIOLATION` |
| Timeout | `QueryTimeoutError` | 503 | `QUERY_TIMEOUT` |

Use `mapTelemetryError(err)` for `{ statusCode, code, message, error, details }`. The `error` field is UI-friendly (no `filters.http_status` Joi paths).

```javascript
const { searchApiCallLogs, mapTelemetryError } = require('@zithara/api-telemetry-lib');

try {
  const result = await searchApiCallLogs(req.body);
  return res.status(200).json(result);
} catch (err) {
  const mapped = mapTelemetryError(err);
  if (mapped) {
    return res.status(mapped.statusCode).json({
      code: mapped.statusCode,
      message: mapped.statusCode === 503 ? 'Search timed out' : 'Could not run search',
      error: mapped.error,
    });
  }
  throw err;
}
```

### Search performance

1. Apply `sql/create-api-call-logs.sql` and `sql/indexes-api-call-logs.sql`.
2. Always bound queries with `requested_at`.
3. Prefer narrow `select_fields`; avoid snapshots unless needed.
4. Use `include_total` only on ≤ 7-day windows.

### Extending filters

1. Add to `FILTER_REGISTRY` in `src/search/filters.js`.
2. Add Joi rule in `src/search/validate-payload.js`.
3. Add tests in `test/search/api-call-log-search.test.js`.
4. Add composite index in `sql/indexes-api-call-logs.sql` if used heavily with `requested_at`.

### Search source map

| Module | Role |
|--------|------|
| `src/search/service.js` | Orchestration |
| `src/search/validate-payload.js` | Joi contract |
| `src/search/guardrails.js` | `include_total` / snapshot limits |
| `src/search/date-range.js` | `requested_at` resolution |
| `src/search/filters.js` | SQL `WHERE` builder |
| `src/search/select-fields.js` | Column allow-list + projection |
| `src/search/repository.js` | `SELECT` / `COUNT` |
| `src/db/query-with-timeout.js` | `SET LOCAL statement_timeout` |

## Safety measures

Measures built into the library to limit data exposure, query cost, and operational risk.

### Write path (`logApiCall`)

| Measure | Behavior |
|---------|----------|
| Input validation | Required fields and types checked before insert; invalid payloads throw `ValidationError` |
| Endpoint hygiene | Callers should log normalized paths only — no access tokens or secrets in `endpoint` |
| Snapshot redaction | Headers such as `Authorization`, `Cookie`, `x-api-key` replaced with `[REDACTED]` |
| Sensitive body keys | Keys matching patterns (`password`, `access_token`, `secret`, etc.) redacted in JSONB |
| Snapshot size cap | Each of `request_snapshot` / `response_snapshot` limited to ~128 KB with truncation metadata |
| JSON depth limit | Deep nesting truncated (`telemetryConfig.write.maxJsonDepth`) |

### Search path (`searchApiCallLogs`)

| Measure | Behavior |
|---------|----------|
| Mandatory date range | `filters.requested_at` required; no fallback range (prevents unbounded table scans) |
| Maximum range | Resolved span cannot exceed **31 days** |
| Page size cap | `pagination.limit` between 1 and **100** (default 50) |
| Allow-listed filters | Only keys in `FILTER_REGISTRY` accepted; unknown filter keys rejected by Joi |
| Allow-listed columns | `select_fields` restricted to defined columns; SQL uses parameterized queries |
| Keyset pagination | Uses `(requested_at, id)` cursor, not `OFFSET` |
| `include_total` limit | `COUNT(*)` only when date range ≤ **7 days** |
| Snapshot fetch limit | When snapshots are included, `limit` cannot exceed **25** |
| Statement timeout | Each search query runs in a transaction with `SET LOCAL statement_timeout` (default 10s, configurable via `API_CALL_LOG_QUERY_TIMEOUT_MS`); overrun returns error with `status: 503` |
| Unknown request keys | Extra keys under `filters` rejected (`unknown(false)` in Joi) |

### Operational

| Measure | Behavior |
|---------|----------|
| Host pool lifecycle | Injected pools are never closed by the library |
| PII and retention | Snapshots may contain request/response bodies; consumers must align logging with retention and privacy policy |
| Non-blocking logging | Recommended pattern: catch logging errors so telemetry failures do not fail business requests |

## `logApiCall` fields

| Field | Required | Notes |
| ----- | -------- | ----- |
| `merchant_id` | Yes | UUID |
| `endpoint` | Yes | Path only; no secrets |
| `http_method` | Yes | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` |
| `response_time_ms` | Yes | Integer ≥ 0 |
| `platform` | Yes | Channel: `instagram`, `facebook`, `whatsapp`, `internal`, etc. (stored lowercased) |
| `api_provider` | Yes | Vendor: `meta`, `zithara`, etc. (stored lowercased) — use `meta` here, not under `platform` |
| `success` | Yes | boolean |
| `user_id` | No | `BIGINT` |
| `instagram_page_id` | No | string |
| `endpoint_group` | No | Grouping label for dashboards |
| `http_status` | No | 100–599 |
| `error_code`, `error_message` | No | strings |
| `request_id`, `trace_id` | No | Correlation IDs |
| `requested_at` | No | Defaults to `NOW()` in the database |
| `request` / `request_snapshot` | No | Sanitized JSONB |
| `response` / `error` / `response_snapshot` | No | Sanitized JSONB |

### Suggested `platform` vs `api_provider`

Documented in `src/config/vars.js` (not enforced at validation — any non-empty string is accepted).

| Field | Meaning | Examples |
|-------|---------|----------|
| `platform` | Which channel or product surface the call relates to | `instagram`, `facebook`, `whatsapp`, `internal` |
| `api_provider` | Who operates the HTTP API you called | `meta` (Graph API), `zithara` (internal APIs) |

Do **not** set `platform` to `meta`. A Meta Graph call for Instagram should use `platform: 'instagram'` and `api_provider: 'meta'`.

## Database schema

DDL: [`sql/create-api-call-logs.sql`](sql/create-api-call-logs.sql).

Columns include: `merchant_id`, `user_id`, `instagram_page_id`, `platform`, `api_provider`, `endpoint`, `endpoint_group`, `http_method`, `http_status`, `success`, `response_time_ms`, `error_code`, `error_message`, `request_id`, `trace_id`, `request_snapshot`, `response_snapshot`, `requested_at`.

Migration for existing tables:

```sql
ALTER TABLE api_call_logs
    ADD COLUMN IF NOT EXISTS user_id BIGINT,
    ADD COLUMN IF NOT EXISTS request_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS response_snapshot JSONB;

ALTER TABLE api_call_logs
    ALTER COLUMN response_time_ms SET NOT NULL;
```

## Comparison with `@zithara/lead-scoring`

| | lead-scoring-lib | api-telemetry-lib |
| --- | --- | --- |
| Database | Host injects Sequelize models | Host injects `pg` Pool or `query` + `runInTransaction` |
| Bootstrap | `initializeLeadScoring({ models, ... })` | `initializeApiTelemetry({ pool })` or `{ query, runInTransaction }` |
| Persistence | Injected repositories | SQL in this package |
| Config | Domain constants | Domain constants + optional env-based pool |

## Package layout

```text
src/
├── runtime/initialize.js    # Bootstrap
├── services/                # logApiCall orchestration
├── validators/              # Write-path validation
├── repositories/            # INSERT
├── search/                  # searchApiCallLogs (Joi, guardrails, SQL)
├── db/                      # Pool, query, transaction, timeout
├── utils/                   # Snapshots, errors, logger
└── index.js                 # Public exports
```

Write: `logApiCall` → validator → service → repository → PostgreSQL.

Search: `searchApiCallLogs` → Joi → guardrails → repository (timeout) → `items`.

## Development

```bash
cd api-telemetry-temp
npm install
cp .env.example .env
npm run lint
npm test
```

| Script | Description |
| ------ | ----------- |
| `npm run lint` | ESLint |
| `npm test` | Jest (`test/search/`, `test/db/`) |

## License

MIT
