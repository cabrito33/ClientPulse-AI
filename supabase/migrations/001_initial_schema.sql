-- ==============================================================================
-- ClientPulse AI — Initial Database Schema & Security Migration
-- Migration: 001_initial_schema.sql
-- Description:
--   1. Extensions (UUID, pg_net, pg_cron)
--   2. Core Tables (agencies, github_integrations, clients, reports, report_tasks)
--   3. Foreign keys with ON DELETE CASCADE to prevent orphaned records
--   4. Indexes for fast queries on foreign keys, portal tokens, and schedules
--   5. Triggers for updated_at timestamps and auto-creating agency on signup
--   6. Strict Row Level Security (RLS) policies for complete multi-tenant isolation
--   7. Sample Seed Data script for local testing
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
-- pgcrypto provides gen_random_uuid() for unique identifiers and secure tokens.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable pg_net for asynchronous HTTP requests from database (used by pg_cron)
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ------------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS
-- ------------------------------------------------------------------------------
-- Function to automatically update the 'updated_at' column whenever a row changes.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. CORE TABLES
-- ------------------------------------------------------------------------------

-- Table: agencies
-- Represents the agency or freelancer workspace.
-- Exactly 1 agency record corresponds to 1 Supabase Auth user (auth.users).
CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Minha Agência',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agencies IS 'Agencies or freelancer workspaces owned by an authenticated user';
COMMENT ON COLUMN public.agencies.user_id IS 'References the Supabase Auth user who owns this agency workspace';

-- Table: github_integrations
-- Stores the agency GitHub Personal Access Token (PAT) for GraphQL API queries.
CREATE TABLE IF NOT EXISTS public.github_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL UNIQUE REFERENCES public.agencies(id) ON DELETE CASCADE,
    pat_token TEXT NOT NULL,
    github_username TEXT,
    is_valid BOOLEAN NOT NULL DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.github_integrations IS 'Stores GitHub Personal Access Tokens securely linked to an agency';

-- Table: clients
-- Stores clients managed by the agency, report tone/language, and delivery schedule.
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company_name TEXT,
    communication_tone TEXT NOT NULL DEFAULT 'executive'
        CHECK (communication_tone IN ('formal', 'executive', 'casual')),
    language TEXT NOT NULL DEFAULT 'pt'
        CHECK (language IN ('pt', 'en')),
    github_project_id TEXT NOT NULL,
    github_project_owner TEXT NOT NULL,
    github_project_type TEXT NOT NULL DEFAULT 'organization'
        CHECK (github_project_type IN ('user', 'organization')),
    column_mapping JSONB NOT NULL DEFAULT '{
        "done": ["Done"],
        "in_progress": ["In Progress"],
        "blocked": ["Blocked"]
    }'::jsonb,
    schedule_day_of_week INT NOT NULL DEFAULT 5
        CHECK (schedule_day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 5=Friday
    schedule_hour_utc INT NOT NULL DEFAULT 9
        CHECK (schedule_hour_utc BETWEEN 0 AND 23),    -- 09:00 UTC (10:00 Lisbon)
    auto_send_enabled BOOLEAN NOT NULL DEFAULT false, -- If true, bypasses manual dashboard review
    portal_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(), -- Permanent zero-login access token
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clients IS 'Clients registered by agencies, including reporting preferences and portal tokens';
COMMENT ON COLUMN public.clients.portal_token IS 'Unguessable UUID token used by the end client to access their portal without login';

-- Table: reports
-- Stores weekly progress reports, AI-generated drafts, and email delivery status.
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'approved', 'sent', 'failed')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    summary_done TEXT NOT NULL,        -- Block 1: Completed deliverables
    summary_blockers TEXT NOT NULL,    -- Block 2: Blockers / Attention points
    summary_next_steps TEXT NOT NULL,  -- Block 3: Next steps & decisions
    raw_github_data JSONB,             -- Audit snapshot of raw cards fetched from GitHub
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    email_delivery_id TEXT,            -- Resend API message identifier
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reports IS 'Weekly executive reports generated by AI and approved by agency managers';

-- Table: report_tasks
-- Normalized task items associated with a report for sprint metrics and portal velocity charts.
CREATE TABLE IF NOT EXISTS public.report_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    github_item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status_category TEXT NOT NULL
        CHECK (status_category IN ('done', 'in_progress', 'blocked')),
    assignee TEXT,
    labels TEXT[] NOT NULL DEFAULT '{}',
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.report_tasks IS 'Granular GitHub task items linked to each report for delivery metrics';

-- ------------------------------------------------------------------------------
-- 4. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_agencies_user_id ON public.agencies(user_id);
CREATE INDEX IF NOT EXISTS idx_github_integrations_agency ON public.github_integrations(agency_id);
CREATE INDEX IF NOT EXISTS idx_clients_agency ON public.clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_clients_portal_token ON public.clients(portal_token);
CREATE INDEX IF NOT EXISTS idx_clients_schedule ON public.clients(schedule_day_of_week, schedule_hour_utc);
CREATE INDEX IF NOT EXISTS idx_reports_client ON public.reports(client_id);
CREATE INDEX IF NOT EXISTS idx_reports_agency_status ON public.reports(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_period ON public.reports(period_end DESC);
CREATE INDEX IF NOT EXISTS idx_report_tasks_report ON public.report_tasks(report_id);
CREATE INDEX IF NOT EXISTS idx_report_tasks_client_status ON public.report_tasks(client_id, status_category);

-- ------------------------------------------------------------------------------
-- 5. AUTOMATIC TIMESTAMP TRIGGERS
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_agencies_updated_at ON public.agencies;
CREATE TRIGGER trigger_agencies_updated_at
    BEFORE UPDATE ON public.agencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_clients_updated_at ON public.clients;
CREATE TRIGGER trigger_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_reports_updated_at ON public.reports;
CREATE TRIGGER trigger_reports_updated_at
    BEFORE UPDATE ON public.reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 6. AUTOMATIC AGENCY PROVISIONING ON SIGNUP
-- ------------------------------------------------------------------------------
-- When a new user registers via Supabase Auth, this function creates their initial agency.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.agencies (user_id, name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'A Minha Agência')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger listening to new users in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
-- Enable RLS on every single table.
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_tasks ENABLE ROW LEVEL SECURITY;

-- 7.1 Agencies Policies
DROP POLICY IF EXISTS "Users can view their own agency" ON public.agencies;
CREATE POLICY "Users can view their own agency"
    ON public.agencies FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own agency" ON public.agencies;
CREATE POLICY "Users can update their own agency"
    ON public.agencies FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 7.2 GitHub Integrations Policies
DROP POLICY IF EXISTS "Users can view their agency github integration" ON public.github_integrations;
CREATE POLICY "Users can view their agency github integration"
    ON public.github_integrations FOR SELECT
    TO authenticated
    USING (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert/update their agency github integration" ON public.github_integrations;
CREATE POLICY "Users can insert/update their agency github integration"
    ON public.github_integrations FOR ALL
    TO authenticated
    USING (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()))
    WITH CHECK (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

-- 7.3 Clients Policies
DROP POLICY IF EXISTS "Users can view their agency clients" ON public.clients;
CREATE POLICY "Users can view their agency clients"
    ON public.clients FOR SELECT
    TO authenticated
    USING (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their agency clients" ON public.clients;
CREATE POLICY "Users can insert their agency clients"
    ON public.clients FOR INSERT
    TO authenticated
    WITH CHECK (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their agency clients" ON public.clients;
CREATE POLICY "Users can update their agency clients"
    ON public.clients FOR UPDATE
    TO authenticated
    USING (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()))
    WITH CHECK (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their agency clients" ON public.clients;
CREATE POLICY "Users can delete their agency clients"
    ON public.clients FOR DELETE
    TO authenticated
    USING (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

-- 7.4 Reports Policies
DROP POLICY IF EXISTS "Users can view their agency reports" ON public.reports;
CREATE POLICY "Users can view their agency reports"
    ON public.reports FOR SELECT
    TO authenticated
    USING (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert reports for their agency" ON public.reports;
CREATE POLICY "Users can insert reports for their agency"
    ON public.reports FOR INSERT
    TO authenticated
    WITH CHECK (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their agency reports" ON public.reports;
CREATE POLICY "Users can update their agency reports"
    ON public.reports FOR UPDATE
    TO authenticated
    USING (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()))
    WITH CHECK (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their agency reports" ON public.reports;
CREATE POLICY "Users can delete their agency reports"
    ON public.reports FOR DELETE
    TO authenticated
    USING (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

-- 7.5 Report Tasks Policies
DROP POLICY IF EXISTS "Users can view their agency report tasks" ON public.report_tasks;
CREATE POLICY "Users can view their agency report tasks"
    ON public.report_tasks FOR SELECT
    TO authenticated
    USING (
        report_id IN (
            SELECT r.id FROM public.reports r
            JOIN public.agencies a ON r.agency_id = a.id
            WHERE a.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can manage their agency report tasks" ON public.report_tasks;
CREATE POLICY "Users can manage their agency report tasks"
    ON public.report_tasks FOR ALL
    TO authenticated
    USING (
        report_id IN (
            SELECT r.id FROM public.reports r
            JOIN public.agencies a ON r.agency_id = a.id
            WHERE a.user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- 8. SEED DATA (MOCK DATA FOR LOCAL TESTING)
-- ------------------------------------------------------------------------------
-- How to run: Execute the block below in the Supabase SQL Editor after creating
-- your first user account in Supabase Auth, or run during local development.

/*
DO $$
DECLARE
    v_user_id UUID;
    v_agency_id UUID;
    v_client_id UUID;
    v_report_id UUID;
BEGIN
    -- 1. Grab the first user from auth.users (or use a test UUID)
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- Get or create agency for this user
        SELECT id INTO v_agency_id FROM public.agencies WHERE user_id = v_user_id;

        IF v_agency_id IS NULL THEN
            INSERT INTO public.agencies (user_id, name)
            VALUES (v_user_id, 'Agência Web Inovação')
            RETURNING id INTO v_agency_id;
        END IF;

        -- 2. Insert test client
        INSERT INTO public.clients (
            agency_id,
            name,
            email,
            company_name,
            communication_tone,
            language,
            github_project_id,
            github_project_owner,
            github_project_type,
            schedule_day_of_week,
            schedule_hour_utc,
            auto_send_enabled,
            portal_token
        ) VALUES (
            v_agency_id,
            'Diogo Cosme',
            'diogo.cosme@iscte.pt',
            'ISCTE SoftDev Lab',
            'executive',
            'pt',
            '1',
            'cabrito33',
            'user',
            5,
            9,
            false,
            'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        )
        ON CONFLICT (portal_token) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_client_id;

        -- 3. Insert sample report
        INSERT INTO public.reports (
            client_id,
            agency_id,
            status,
            period_start,
            period_end,
            summary_done,
            summary_blockers,
            summary_next_steps,
            sent_at
        ) VALUES (
            v_client_id,
            v_agency_id,
            'sent',
            CURRENT_DATE - INTERVAL '7 days',
            CURRENT_DATE,
            '• Concluída a especificação técnica da arquitetura e contratos de API no repositório.' || E'\n' ||
            '• Criado o esquema inicial da base de dados no Supabase com isolamento rigoroso por RLS.' || E'\n' ||
            '• Configurado o pipeline de automação e integração contínua.',
            '• Nenhuma dependência crítica ou bloqueio identificado nesta semana de arranque.',
            '• Implementar os conectores da API GraphQL do GitHub Projects v2.' || E'\n' ||
            '• Desenvolver a primeira versão do gerador de sínteses com Google Gemini.',
            now()
        ) RETURNING id INTO v_report_id;

        -- 4. Insert sample sprint tasks
        INSERT INTO public.report_tasks (report_id, client_id, github_item_id, title, status_category, assignee, labels, closed_at)
        VALUES
            (v_report_id, v_client_id, 'GH_ITEM_101', 'Arquitetura e planeamento backend', 'done', 'Lima-stack', ARRAY['backend', 'docs'], now()),
            (v_report_id, v_client_id, 'GH_ITEM_102', 'Esquema PostgreSQL e migrações RLS', 'done', 'Lima-stack', ARRAY['database', 'security'], now()),
            (v_report_id, v_client_id, 'GH_ITEM_103', 'Integração GraphQL GitHub Projects v2', 'in_progress', 'Lima-stack', ARRAY['backend'], NULL);

        RAISE NOTICE 'Seed executado com sucesso para a agência % (Cliente: %)', v_agency_id, v_client_id;
    ELSE
        RAISE NOTICE 'Nenhum utilizador encontrado em auth.users. Cria um utilizador primeiro para aplicar o seed.';
    END IF;
END $$;
*/