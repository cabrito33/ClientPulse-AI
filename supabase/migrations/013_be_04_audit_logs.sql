-- ==============================================================================
-- ClientPulse AI — Schema Migration: Audit Logs & Updated_At Trigger Completeness
-- Migration: 013_be_04_audit_logs.sql
-- Issue: [BE-04] [P2] [M] Auditoria Mínima de Ações Críticas
--
-- ALTERAÇÕES:
-- 1. Verificação e garantia de triggers updated_at em todas as tabelas com a coluna.
-- 2. Criação da tabela public.audit_logs com Row Level Security (RLS) restrita.
--    - Apenas a agência proprietária pode efetuar SELECT nos seus próprios logs.
--    - Roles da aplicação (authenticated, anon) NÃO podem executar INSERT, UPDATE nem DELETE.
-- 3. Triggers automáticos com SECURITY DEFINER e search_path fixo para:
--    - reports: criação e transições de estado (draft, approved, sent, failed).
--    - portal_tokens: criação e revogação.
--    - clients: criação, remoção e alteração de agendamento ou auto_send_enabled.
--    - github_integrations: ligação, atualização e remoção.
-- 4. Salvaguarda estrita de segurança: o campo details NUNCA armazena pat_token,
--    pat_token_encrypted, ou portal_token.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. GARANTIR TRIGGERS DE UPDATED_AT EM TODAS AS TABELAS RELEVANTES
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- 1.1 Agencies
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_agencies_updated_at') THEN
        CREATE TRIGGER trigger_agencies_updated_at
            BEFORE UPDATE ON public.agencies
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    -- 1.2 Clients
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_clients_updated_at') THEN
        CREATE TRIGGER trigger_clients_updated_at
            BEFORE UPDATE ON public.clients
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    -- 1.3 Reports
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_reports_updated_at') THEN
        CREATE TRIGGER trigger_reports_updated_at
            BEFORE UPDATE ON public.reports
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    -- 1.4 Profiles (se a tabela existir)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_profiles_updated_at') THEN
            CREATE TRIGGER trigger_profiles_updated_at
                BEFORE UPDATE ON public.profiles
                FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        END IF;
    END IF;

    -- 1.5 Sprint Metrics (se a tabela existir)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sprint_metrics') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_sprint_metrics_updated_at') THEN
            CREATE TRIGGER trigger_sprint_metrics_updated_at
                BEFORE UPDATE ON public.sprint_metrics
                FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        END IF;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. TABELA: public.audit_logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_logs IS 'Registo de auditoria imutável de eventos críticos da agência (BE-04).';
COMMENT ON COLUMN public.audit_logs.actor_user_id IS 'ID do utilizador auth.uid() que desencadeou a ação, ou NULL se executado por worker/cron de backend.';
COMMENT ON COLUMN public.audit_logs.details IS 'Metadados contextuais do evento em JSONB. NUNCA contém credenciais, segredos, PATs ou tokens de portal.';

CREATE INDEX IF NOT EXISTS idx_audit_logs_agency_created ON public.audit_logs(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- Ativar Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política de Leitura: A agência só lê os seus próprios registos de auditoria
DROP POLICY IF EXISTS "Agencies can view their own audit logs" ON public.audit_logs;
CREATE POLICY "Agencies can view their own audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (agency_id = public.get_my_agency_id());

-- Bloqueio explícito de escrita na aplicação:
-- Nenhum utilizador autenticado nem anónimo pode inserir, atualizar ou apagar na tabela audit_logs.
-- As inserções são geradas exclusivamente pelos triggers internos SECURITY DEFINER.
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated, anon, public;
GRANT SELECT ON public.audit_logs TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. TRIGGERS DE AUDITORIA (SECURITY DEFINER COM search_path FIXO)
-- ------------------------------------------------------------------------------

-- 3.1 Trigger para public.reports (criação e alterações de estado)
CREATE OR REPLACE FUNCTION public.log_report_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action TEXT;
    v_details JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'report_created';
        v_details := jsonb_build_object(
            'client_id', NEW.client_id,
            'status', NEW.status,
            'period_start', NEW.period_start,
            'period_end', NEW.period_end
        );
        INSERT INTO public.audit_logs (
            agency_id, actor_user_id, action, entity_type, entity_id, details
        ) VALUES (
            NEW.agency_id, auth.uid(), v_action, 'report', NEW.id, v_details
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_action := 'report_' || NEW.status; -- report_approved, report_sent, report_failed, report_draft
            v_details := jsonb_build_object(
                'client_id', NEW.client_id,
                'old_status', OLD.status,
                'new_status', NEW.status
            );
            INSERT INTO public.audit_logs (
                agency_id, actor_user_id, action, entity_type, entity_id, details
            ) VALUES (
                NEW.agency_id, auth.uid(), v_action, 'report', NEW.id, v_details
            );
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_reports ON public.reports;
CREATE TRIGGER trigger_audit_reports
    AFTER INSERT OR UPDATE OF status ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.log_report_audit();

-- 3.2 Trigger para public.portal_tokens (criação e revogação)
CREATE OR REPLACE FUNCTION public.log_portal_token_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action TEXT;
    v_details JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'portal_token_created';
        -- SEGURANÇA ESTREITA: NUNCA regista NEW.token em details
        v_details := jsonb_build_object(
            'client_id', NEW.client_id,
            'is_active', NEW.is_active,
            'expires_at', NEW.expires_at
        );
        INSERT INTO public.audit_logs (
            agency_id, actor_user_id, action, entity_type, entity_id, details
        ) VALUES (
            NEW.agency_id, auth.uid(), v_action, 'portal_token', NEW.id, v_details
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)
           OR (OLD.is_active = true AND NEW.is_active = false) THEN
            v_action := 'portal_token_revoked';
            -- SEGURANÇA ESTREITA: NUNCA regista NEW.token em details
            v_details := jsonb_build_object(
                'client_id', NEW.client_id,
                'revoked_at', NEW.revoked_at,
                'is_active', NEW.is_active
            );
            INSERT INTO public.audit_logs (
                agency_id, actor_user_id, action, entity_type, entity_id, details
            ) VALUES (
                NEW.agency_id, auth.uid(), v_action, 'portal_token', NEW.id, v_details
            );
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_portal_tokens ON public.portal_tokens;
CREATE TRIGGER trigger_audit_portal_tokens
    AFTER INSERT OR UPDATE ON public.portal_tokens
    FOR EACH ROW EXECUTE FUNCTION public.log_portal_token_audit();

-- 3.3 Trigger para public.clients (criação, remoção e alteração de agendamento/auto_send)
CREATE OR REPLACE FUNCTION public.log_client_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action TEXT;
    v_details JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'client_created';
        -- SEGURANÇA ESTREITA: NUNCA regista portal_token em details
        v_details := jsonb_build_object(
            'name', NEW.name,
            'company_name', NEW.company_name,
            'email', NEW.email,
            'schedule_day_of_week', NEW.schedule_day_of_week,
            'schedule_hour_utc', NEW.schedule_hour_utc,
            'auto_send_enabled', NEW.auto_send_enabled
        );
        INSERT INTO public.audit_logs (
            agency_id, actor_user_id, action, entity_type, entity_id, details
        ) VALUES (
            NEW.agency_id, auth.uid(), v_action, 'client', NEW.id, v_details
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.schedule_day_of_week IS DISTINCT FROM NEW.schedule_day_of_week
           OR OLD.schedule_hour_utc IS DISTINCT FROM NEW.schedule_hour_utc
           OR OLD.auto_send_enabled IS DISTINCT FROM NEW.auto_send_enabled THEN
            v_action := 'client_schedule_updated';
            v_details := jsonb_build_object(
                'name', NEW.name,
                'old_schedule_day', OLD.schedule_day_of_week,
                'new_schedule_day', NEW.schedule_day_of_week,
                'old_schedule_hour', OLD.schedule_hour_utc,
                'new_schedule_hour', NEW.schedule_hour_utc,
                'old_auto_send_enabled', OLD.auto_send_enabled,
                'new_auto_send_enabled', NEW.auto_send_enabled
            );
            INSERT INTO public.audit_logs (
                agency_id, actor_user_id, action, entity_type, entity_id, details
            ) VALUES (
                NEW.agency_id, auth.uid(), v_action, 'client', NEW.id, v_details
            );
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'client_deleted';
        v_details := jsonb_build_object(
            'name', OLD.name,
            'company_name', OLD.company_name,
            'email', OLD.email
        );
        INSERT INTO public.audit_logs (
            agency_id, actor_user_id, action, entity_type, entity_id, details
        ) VALUES (
            OLD.agency_id, auth.uid(), v_action, 'client', OLD.id, v_details
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_clients ON public.clients;
CREATE TRIGGER trigger_audit_clients
    AFTER INSERT OR UPDATE OR DELETE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.log_client_audit();

-- 3.4 Trigger para public.github_integrations (ligação, atualização e remoção)
CREATE OR REPLACE FUNCTION public.log_github_integration_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action TEXT;
    v_details JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'github_integration_connected';
        -- SEGURANÇA ESTREITA: NUNCA regista pat_token ou pat_token_encrypted em details
        v_details := jsonb_build_object(
            'github_username', NEW.github_username,
            'is_valid', NEW.is_valid
        );
        INSERT INTO public.audit_logs (
            agency_id, actor_user_id, action, entity_type, entity_id, details
        ) VALUES (
            NEW.agency_id, auth.uid(), v_action, 'github_integration', NEW.id, v_details
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'github_integration_updated';
        -- SEGURANÇA ESTREITA: NUNCA regista pat_token ou pat_token_encrypted em details
        v_details := jsonb_build_object(
            'github_username', NEW.github_username,
            'is_valid', NEW.is_valid,
            'last_synced_at', NEW.last_synced_at
        );
        INSERT INTO public.audit_logs (
            agency_id, actor_user_id, action, entity_type, entity_id, details
        ) VALUES (
            NEW.agency_id, auth.uid(), v_action, 'github_integration', NEW.id, v_details
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'github_integration_removed';
        -- SEGURANÇA ESTREITA: NUNCA regista pat_token ou pat_token_encrypted em details
        v_details := jsonb_build_object(
            'github_username', OLD.github_username
        );
        INSERT INTO public.audit_logs (
            agency_id, actor_user_id, action, entity_type, entity_id, details
        ) VALUES (
            OLD.agency_id, auth.uid(), v_action, 'github_integration', OLD.id, v_details
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_github_integrations ON public.github_integrations;
CREATE TRIGGER trigger_audit_github_integrations
    AFTER INSERT OR UPDATE OR DELETE ON public.github_integrations
    FOR EACH ROW EXECUTE FUNCTION public.log_github_integration_audit();
