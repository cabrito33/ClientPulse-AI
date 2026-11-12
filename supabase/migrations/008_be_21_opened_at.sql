-- ==============================================================================
-- ClientPulse AI — Schema Migration: BE-21 Email Open Tracking (opened_at)
-- Migration: 004_be_21_opened_at.sql
-- Issue: [BE-21] [P2] [M] Webhook/tracking de abertura de e-mail (openedAt) #35
--
-- CRITÉRIOS DE ACEITAÇÃO:
-- 1. Endpoint regista data/hora da primeira abertura
-- 2. openedAt visível no dashboard
-- 3. Pedidos repetidos não sobrescrevem o primeiro registo
-- ==============================================================================

-- 1. Add opened_at column to public.reports if not exists
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;

COMMENT ON COLUMN public.reports.opened_at IS 'Timestamp of the first time the client opened the report email or portal';

-- 2. Add opened_at column to public.delivery_logs if not exists
ALTER TABLE public.delivery_logs 
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;

COMMENT ON COLUMN public.delivery_logs.opened_at IS 'Timestamp when the email was opened via tracking pixel or webhook';

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_reports_opened_at ON public.reports(opened_at);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_opened_at ON public.delivery_logs(opened_at);
CREATE INDEX IF NOT EXISTS idx_reports_email_delivery_id ON public.reports(email_delivery_id);

-- 4. Idempotent Stored Procedure to atomically record the first open timestamp
-- Guarantees that subsequent calls DO NOT overwrite the first recorded timestamp.
CREATE OR REPLACE FUNCTION public.record_report_open(
    p_report_id UUID,
    p_opened_at TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
    report_id UUID,
    opened_at TIMESTAMPTZ,
    is_first_open BOOLEAN
) AS $$
DECLARE
    v_existing_opened_at TIMESTAMPTZ;
BEGIN
    -- Check existing status
    SELECT r.opened_at INTO v_existing_opened_at
    FROM public.reports r
    WHERE r.id = p_report_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Report with ID % not found', p_report_id;
    END IF;

    -- If already opened, return the original timestamp without modifying
    IF v_existing_opened_at IS NOT NULL THEN
        RETURN QUERY SELECT p_report_id, v_existing_opened_at, FALSE;
        RETURN;
    END IF;

    -- Atomic update: only update if still NULL
    UPDATE public.reports
    SET opened_at = p_opened_at,
        updated_at = now()
    WHERE id = p_report_id AND public.reports.opened_at IS NULL
    RETURNING public.reports.opened_at INTO v_existing_opened_at;

    -- Also update delivery_logs if present
    UPDATE public.delivery_logs
    SET opened_at = p_opened_at
    WHERE report_id = p_report_id AND public.delivery_logs.opened_at IS NULL;

    RETURN QUERY SELECT p_report_id, COALESCE(v_existing_opened_at, p_opened_at), TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.record_report_open IS 'Atomically records the first open timestamp of a report. Idempotent: repeated calls never overwrite the initial timestamp.';
