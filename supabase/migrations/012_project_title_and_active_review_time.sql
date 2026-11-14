-- ==============================================================================
-- ClientPulse AI — Schema Migration: Project Title, Active Review Time & Success Metrics
-- Migration: 012_project_title_and_active_review_time.sql
--
-- ALTERAÇÕES:
-- 1. Nova coluna clients.github_project_title (TEXT NULL) para armazenar o título
--    do board do GitHub em vez de mostrar o ID interno PVT_ ou o owner ao cliente.
-- 2. Backfill de clients.github_project_title com COALESCE(company_name, name).
-- 3. Nova coluna reports.review_opened_at (TIMESTAMPTZ NULL) para registar o momento
--    em que a agência abre o ecrã de revisão pela 1.ª vez (tempo ativo de revisão).
-- 4. Atualização da função RPC get_portal_data_by_token para incluir github_project_title.
-- 5. Atualização da view success_metrics para calcular o tempo ativo médio de revisão.
-- ==============================================================================

-- 1. Adicionar github_project_title à tabela clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS github_project_title TEXT NULL;

COMMENT ON COLUMN public.clients.github_project_title IS
  'Título legível do projeto/board no GitHub (ex: ClientPulse AI). Mostrado no portal e no e-mail em vez de IDs internos.';

-- 2. Backfill para clientes existentes
UPDATE public.clients
SET github_project_title = COALESCE(company_name, name)
WHERE github_project_title IS NULL;

-- 3. Adicionar review_opened_at à tabela reports
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS review_opened_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.reports.review_opened_at IS
  'Registo temporal da primeira vez que a agência abriu o ecrã de revisão deste relatório (permite calcular o tempo ativo de revisão).';

-- 4. Atualizar RPC get_portal_data_by_token(UUID) com fail-closed estrito e inclusão de github_project_title
CREATE OR REPLACE FUNCTION public.get_portal_data_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_token_record RECORD;
    v_client RECORD;
    v_reports JSONB;
    v_metrics JSONB;
BEGIN
    -- Rejeitar tokens nulos
    IF p_token IS NULL THEN
        RETURN NULL;
    END IF;

    -- FAIL-CLOSED: O token DEVE existir na tabela portal_tokens, estar ativo,
    -- NÃO estar revogado (revoked_at IS NULL) e NÃO estar expirado (expires_at > now()).
    SELECT * INTO v_token_record
    FROM public.portal_tokens
    WHERE token = p_token
      AND is_active = true
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;

    -- Se não encontrar nenhum token ativo e válido, falhar fechado
    IF v_token_record.id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Obter o cliente associado ao token
    SELECT * INTO v_client
    FROM public.clients
    WHERE id = v_token_record.client_id
    LIMIT 1;

    IF v_client.id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Obter relatórios do cliente
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', r.id,
                'client_id', r.client_id,
                'agency_id', r.agency_id,
                'status', r.status,
                'period_start', r.period_start,
                'period_end', r.period_end,
                'summary_done', r.summary_done,
                'summary_blockers', r.summary_blockers,
                'summary_next_steps', r.summary_next_steps,
                'raw_github_data', r.raw_github_data,
                'approved_at', r.approved_at,
                'sent_at', r.sent_at,
                'opened_at', r.opened_at,
                'email_delivery_id', r.email_delivery_id,
                'created_at', r.created_at,
                'updated_at', r.updated_at
            ) ORDER BY r.period_end DESC
        ),
        '[]'::jsonb
    ) INTO v_reports
    FROM public.reports r
    WHERE r.client_id = v_client.id
      AND r.status IN ('sent', 'approved');

    -- Obter métricas de sprint
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'sprint', sm.sprint,
                'label', sm.label,
                'completed', sm.completed,
                'planned', sm.planned
            ) ORDER BY sm.sprint ASC
        ),
        '[]'::jsonb
    ) INTO v_metrics
    FROM public.sprint_metrics sm
    WHERE sm.client_id = v_client.id;

    -- Retornar payload estruturado com github_project_title protegido
    RETURN jsonb_build_object(
        'client', jsonb_build_object(
            'id', v_client.id,
            'agency_id', v_client.agency_id,
            'name', v_client.name,
            'company_name', v_client.company_name,
            'email', v_client.email,
            'communication_tone', v_client.communication_tone,
            'language', v_client.language,
            'portal_token', v_token_record.token,
            'github_project_title', COALESCE(v_client.github_project_title, v_client.company_name, v_client.name),
            'github_project_id', v_client.github_project_id,
            'github_project_owner', v_client.github_project_owner,
            'schedule_day_of_week', v_client.schedule_day_of_week,
            'schedule_hour_utc', v_client.schedule_hour_utc,
            'auto_send_enabled', v_client.auto_send_enabled,
            'column_mapping', v_client.column_mapping,
            'created_at', v_client.created_at
        ),
        'reports', v_reports,
        'metrics', v_metrics,
        'token_metadata', jsonb_build_object(
            'expires_at', v_token_record.expires_at,
            'created_at', v_token_record.created_at
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_data_by_token(UUID) TO anon, authenticated;

-- 5. Atualizar view success_metrics (security_invoker = true)
DROP VIEW IF EXISTS public.success_metrics;

CREATE VIEW public.success_metrics
WITH (security_invoker = true)
AS
SELECT
    a.id AS agency_id,
    -- Duração do onboarding em segundos
    CASE 
        WHEN a.onboarding_started_at IS NOT NULL AND a.onboarding_completed_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (a.onboarding_completed_at - a.onboarding_started_at))::INT
        ELSE NULL
    END AS onboarding_duration_seconds,

    -- Contagens de relatórios
    COUNT(r.id)::INT AS total_reports,
    COUNT(r.id) FILTER (WHERE r.status IN ('approved', 'sent'))::INT AS total_approved_or_sent,
    COUNT(r.id) FILTER (WHERE r.status = 'sent')::INT AS total_sent,

    -- Média de edições por rascunho aprovado/enviado
    COALESCE(
        ROUND(AVG(r.edit_count) FILTER (WHERE r.status IN ('approved', 'sent')), 1),
        0.0
    )::NUMERIC AS avg_edit_count,

    -- % de rascunhos aprovados com menos de 3 edições
    COALESCE(
        ROUND(
            (COUNT(r.id) FILTER (WHERE r.status IN ('approved', 'sent') AND COALESCE(r.edit_count, 0) < 3)::NUMERIC
             * 100.0 / NULLIF(COUNT(r.id) FILTER (WHERE r.status IN ('approved', 'sent')), 0)),
            1
        ),
        0.0
    )::NUMERIC AS pct_approved_under_3_edits,

    -- Tempo ativo médio de revisão (em segundos, ignorando nulos de bypass/sem abertura)
    COALESCE(
        ROUND(AVG(r.time_to_approve_seconds) FILTER (WHERE r.time_to_approve_seconds IS NOT NULL))::INT,
        0
    ) AS avg_time_to_approve_seconds,

    -- % de relatórios abertos nas primeiras 24h face aos enviados
    COALESCE(
        ROUND(
            (COUNT(r.id) FILTER (WHERE r.status = 'sent' AND r.opened_at IS NOT NULL AND r.sent_at IS NOT NULL AND r.opened_at <= (r.sent_at + INTERVAL '24 hours'))::NUMERIC
             * 100.0 / NULLIF(COUNT(r.id) FILTER (WHERE r.status = 'sent'), 0)),
            1
        ),
        0.0
    )::NUMERIC AS pct_opened_24h,

    -- % de relatórios gerados sem IA (modo fallback)
    COALESCE(
        ROUND(
            (COUNT(r.id) FILTER (WHERE (r.raw_github_data->>'generated_without_ai')::BOOLEAN IS TRUE)::NUMERIC
             * 100.0 / NULLIF(COUNT(r.id), 0)),
            1
        ),
        0.0
    )::NUMERIC AS pct_generated_without_ai

FROM public.agencies a
LEFT JOIN public.reports r ON r.agency_id = a.id
GROUP BY a.id, a.onboarding_started_at, a.onboarding_completed_at;

GRANT SELECT ON public.success_metrics TO authenticated, anon;
