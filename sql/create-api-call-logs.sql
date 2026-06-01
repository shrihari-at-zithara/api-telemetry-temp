-- api-telemetry-lib: api_call_logs table
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS api_call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    merchant_id UUID NOT NULL,
    user_id BIGINT,
    instagram_page_id TEXT,

    platform TEXT NOT NULL,
    api_provider TEXT NOT NULL,

    endpoint TEXT NOT NULL,
    endpoint_group TEXT,

    http_method TEXT NOT NULL,

    http_status SMALLINT,
    success BOOLEAN NOT NULL,

    response_time_ms INTEGER NOT NULL,

    error_code TEXT,
    error_message TEXT,

    request_id TEXT,
    trace_id UUID,

    request_snapshot JSONB,
    response_snapshot JSONB,

    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
