-- ==============================================================================
-- ClientPulse AI — Scheduling Automation Migration
-- Migration: 002_cron_scheduler.sql
-- Description:
--   Sets up pg_cron and pg_net to periodically invoke the Edge Function
--   'dispatch-scheduled-reports' to check which clients are due for report
--   generation and email dispatch.
-- ==============================================================================

-- 1. Ensure required extensions are active
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Schedule the hourly dispatcher job
-- Runs every hour at minute 0 ('0 * * * *')
-- Calls the Edge Function asynchronously via HTTP POST using pg_net.
-- Replace <PROJECT_REF> and <SCHEDULED_SECRET> with your actual values in production.

/*
SELECT cron.schedule(
    'dispatch-reports-hourly',
    '0 * * * *', -- Every hour on the hour
    $$
    SELECT net.http_post(
        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/dispatch-scheduled-reports',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Scheduled-Secret', '<YOUR_SCHEDULED_FUNCTION_SECRET>'
        ),
        body := '{}'::jsonb
    );
    $$
);
*/

COMMENT ON EXTENSION pg_cron IS 'Cron scheduler used to invoke dispatch-scheduled-reports periodically';
