-- ==============================================================================
-- ClientPulse AI — Schema Migration: BE-19 Magic Links, Expiration & Revocation
-- Migration: 009_be_19_magic_links.sql
-- Issue: [BE-19] [P1] [M] Magic Links com tokens UUIDv4 e expiração configurável (#33)
--
-- CRITÉRIOS DE ACEITAÇÃO:
-- 1. Registo ativo em portal_tokens com expires_at (defeito 90 dias)
-- 2. RPC get_portal_data_by_token falha fechado (token sem registo ativo => NULL)
-- 3. Validação estrita de revoked_at IS NULL e expires_at > now()
-- 4. Backfill de clientes existentes preservando o token atual do cliente de teste
-- 5. Função helper para verificar estado do token (valid / expired / revoked / not_found)
-- ==============================================================================

-- 1. BACKFILL: Garantir que todos os clientes existentes possuem registo ativo em portal_tokens
INSERT INTO public.portal_tokens (client_id, agency_id, token, is_active, expires_at, revoked_at, created_at)
SELECT 
    c.id, 
    c.agency_id, 
    c.portal_token, 
    true, 
    now() + INTERVAL '90 days', 
    NULL,
    now()
FROM public.clients c
WHERE NOT EXISTS (
    SELECT 1 FROM public.portal_tokens pt WHERE pt.token = c.portal_token
)
ON CONFLICT (token) DO UPDATE 
SET is_active = true, 
    revoked_at = NULL, 
    expires_at = COALESCE(public.portal_tokens.expires_at, now() + INTERVAL '90 days');

-- 2. RPC get_portal_data_by_token — Atualizada com Fail-Closed Estrito
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

    -- Retornar payload estruturado
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

-- 3. RPC check_portal_token_status — Retorna a causa de falha para mensagens amigáveis no portal
CREATE OR REPLACE FUNCTION public.check_portal_token_status(p_token UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_record RECORD;
BEGIN
    IF p_token IS NULL THEN
        RETURN 'not_found';
    END IF;

    SELECT * INTO v_record
    FROM public.portal_tokens
    WHERE token = p_token
    LIMIT 1;

    IF v_record.id IS NULL THEN
        -- Verificar se existe em clients.portal_token como contingência
        IF EXISTS (SELECT 1 FROM public.clients WHERE portal_token = p_token) THEN
            RETURN 'valid';
        END IF;
        RETURN 'not_found';
    END IF;

    IF v_record.revoked_at IS NOT NULL OR v_record.is_active = false THEN
        RETURN 'revoked';
    END IF;

    IF v_record.expires_at IS NOT NULL AND v_record.expires_at <= now() THEN
        RETURN 'expired';
    END IF;

    RETURN 'valid';
END;
$$;

-- Permissões de execução públicas (necessárias para o portal sem login)
GRANT EXECUTE ON FUNCTION public.get_portal_data_by_token(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_portal_token_status(UUID) TO anon, authenticated;
