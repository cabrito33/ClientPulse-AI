-- ==============================================================================
-- ClientPulse AI — Schema Migration: BE-01 Complete Tables
-- Migration: 003_be_01_complete_schema.sql
-- Issue: [BE-01] [P0] [L] Criar schema PostgreSQL no Supabase #15
--
-- DESCRIPTION:
-- Completes the database schema ensuring all 6 canonical tables exist:
--   1. public.profiles (User profile linked 1:1 to auth.users and agency)
--   2. public.clients (Clients managed by agencies, preferences & schedule)
--   3. public.reports (Weekly reports in 3 executive blocks)
--   4. public.sprint_metrics (Aggregated velocity metrics per client & sprint)
--   5. public.portal_tokens (Dedicated table for token management, rotation & expiration)
--   6. public.delivery_logs (Audit log of transactional email dispatches)
--
-- NOTE:
-- Also retains public.agencies, public.github_integrations and public.report_tasks
-- to preserve 100% backward compatibility with all existing Edge Functions.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ------------------------------------------------------------------------------
-- 2. TABLE: public.profiles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'User profile linked 1:1 with Supabase Auth users';

CREATE INDEX IF NOT EXISTS idx_profiles_agency ON public.profiles(agency_id);

-- ------------------------------------------------------------------------------
-- 3. TABLE: public.sprint_metrics
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sprint_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    sprint TEXT NOT NULL,         -- e.g. 'S42'
    label TEXT NOT NULL,          -- e.g. 'Semana 42'
    completed INT NOT NULL DEFAULT 0 CHECK (completed >= 0),
    planned INT NOT NULL DEFAULT 0 CHECK (planned >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sprint_metrics IS 'Sprint velocity metrics per client for dashboard and portal charts';

CREATE INDEX IF NOT EXISTS idx_sprint_metrics_client ON public.sprint_metrics(client_id, sprint);
CREATE INDEX IF NOT EXISTS idx_sprint_metrics_agency ON public.sprint_metrics(agency_id);

-- ------------------------------------------------------------------------------
-- 4. TABLE: public.portal_tokens
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,       -- NULL means perpetual token; or timestamp for expiration
    revoked_at TIMESTAMPTZ,       -- Timestamp when token was manually revoked
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.portal_tokens IS 'Dedicated portal tokens with support for revocation and expiration';

CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON public.portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_client ON public.portal_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_active ON public.portal_tokens(is_active) WHERE is_active = true;

-- ------------------------------------------------------------------------------
-- 5. TABLE: public.delivery_logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),
    email_service TEXT NOT NULL DEFAULT 'resend',
    recipient_email TEXT NOT NULL,
    message_id TEXT,             -- External message ID returned by Resend
    error_message TEXT,          -- Error details if dispatch failed
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.delivery_logs IS 'Audit log of email deliveries, message IDs, and failure reasons';

CREATE INDEX IF NOT EXISTS idx_delivery_logs_report ON public.delivery_logs(report_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_client ON public.delivery_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_agency ON public.delivery_logs(agency_id);

-- ------------------------------------------------------------------------------
-- 6. AUTOMATIC TIMESTAMPS TRIGGERS
-- ------------------------------------------------------------------------------
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_sprint_metrics_updated_at
    BEFORE UPDATE ON public.sprint_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 7. AUTO-PROVISION PROFILE & AGENCY ON SIGNUP
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_agency_id UUID;
    v_full_name TEXT;
BEGIN
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        'Novo Utilizador'
    );

    -- 1. Create default agency workspace
    INSERT INTO public.agencies (user_id, name)
    VALUES (NEW.id, 'Minha Agência')
    RETURNING id INTO v_agency_id;

    -- 2. Create user profile
    INSERT INTO public.profiles (id, agency_id, full_name, email, role)
    VALUES (NEW.id, v_agency_id, v_full_name, NEW.email, 'owner');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_logs ENABLE ROW LEVEL SECURITY;

-- 8.1 Profiles Policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 8.2 Sprint Metrics Policies
CREATE POLICY "Agencies can view their sprint metrics"
    ON public.sprint_metrics FOR SELECT
    TO authenticated
    USING (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

CREATE POLICY "Agencies can manage their sprint metrics"
    ON public.sprint_metrics FOR ALL
    TO authenticated
    USING (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()))
    WITH CHECK (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

-- 8.3 Portal Tokens Policies
CREATE POLICY "Agencies can view and manage their portal tokens"
    ON public.portal_tokens FOR ALL
    TO authenticated
    USING (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()))
    WITH CHECK (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

-- 8.4 Delivery Logs Policies
CREATE POLICY "Agencies can view their delivery logs"
    ON public.delivery_logs FOR SELECT
    TO authenticated
    USING (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

CREATE POLICY "Agencies can insert delivery logs"
    ON public.delivery_logs FOR INSERT
    TO authenticated
    WITH CHECK (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

-- ------------------------------------------------------------------------------
-- 9. BACKFILL EXISTING CLIENT PORTAL TOKENS INTO portal_tokens TABLE
-- ------------------------------------------------------------------------------
-- If clients already exist with a portal_token column, mirror them in portal_tokens
INSERT INTO public.portal_tokens (client_id, agency_id, token, is_active, created_at)
SELECT c.id, c.agency_id, c.portal_token, true, c.created_at
FROM public.clients c
ON CONFLICT (token) DO NOTHING;
