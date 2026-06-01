-- Performance indexes for api_call_logs list/search queries.
-- Apply after create-api-call-logs.sql. Safe to run multiple times (IF NOT EXISTS).

-- Primary access pattern: time-ordered scans with keyset pagination
CREATE INDEX IF NOT EXISTS idx_api_call_logs_requested_at_id_desc
  ON api_call_logs (requested_at DESC, id DESC);

-- Merchant-scoped dashboards
CREATE INDEX IF NOT EXISTS idx_api_call_logs_merchant_requested_at_desc
  ON api_call_logs (merchant_id, requested_at DESC, id DESC);

-- Optional: filter-heavy queries (uncomment if used frequently)
-- CREATE INDEX IF NOT EXISTS idx_api_call_logs_endpoint_requested_at_desc
--   ON api_call_logs (endpoint, requested_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_api_call_logs_provider_requested_at_desc
--   ON api_call_logs (api_provider, requested_at DESC);
