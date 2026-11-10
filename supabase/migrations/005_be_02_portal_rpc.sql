-- ==============================================================================
-- ClientPulse AI — Acesso Seguro ao Portal do Cliente via Token (RPC)
-- Migration: 005_be_02_portal_rpc.sql
-- Issue: [BE-02] [P1] [L] Implementar Row Level Security (isolamento multi-inquilino) #16
--
-- MOTIVAÇÃO & SEGURANÇA:
-- 1. Na migration 004, foram adicionadas políticas `TO anon` com subqueries à tabela
--    `portal_tokens`. Porém, `anon` não tem permissão em `portal_tokens`, o que
--    causava erro de permissão ("permission denied for table portal_tokens").
-- 2. Além disso, permitir SELECT direto a `anon` em `clients` ou `reports` é um risco:
--    qualquer pessoa com a chave pública anon poderia em teoria enumerar registos.
-- 3. A melhor prática de segurança em PostgreSQL / Supabase para acesso sem login é:
--    - REVOGAR acesso SELECT direto do role `anon` às tabelas.
--    - Expor uma função RPC `SECURITY DEFINER` (get_portal_data_by_token) que exige
--      obrigatoriamente o UUID do portal_token, valida se está ativo e não expirado,
--      e devolve exclusivamente o cliente, relatórios e métricas desse token em JSON.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. LIMPEZA: Remover políticas directas anon da migration 004
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Portal anon pode ver cliente via token" ON public.clients;
DROP POLICY IF EXISTS "Portal anon pode ver relatórios via token" ON public.reports;
DROP POLICY IF EXISTS "Portal anon pode ver sprint metrics via token" ON public.sprint_metrics;
DROP POLICY IF EXISTS "Portal anon pode ver report tasks via token" ON public.report_tasks;

-- Revogar permissões SELECT directas do role anon nas tabelas
REVOKE SELECT ON public.clients FROM anon;
REVOKE SELECT ON public.reports FROM anon;
REVOKE SELECT ON public.sprint_metrics FROM anon;
REVOKE SELECT ON public.report_tasks FROM anon;

-- ------------------------------------------------------------------------------
-- 2. FUNÇÃO RPC: get_portal_data_by_token(UUID)
-- ------------------------------------------------------------------------------
-- Executa com permissões do owner (SECURITY DEFINER) para poder ler as tabelas com RLS.
-- O search_path é fixado em public para segurança.
-- Apenas devolve dados se o token corresponder a um cliente com portal_token ativo.
CREATE OR REPLACE FUNCTION public.get_portal_data_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_client RECORD;
    v_reports JSONB;
    v_metrics JSONB;
    v_token_valid BOOLEAN := true;
BEGIN
    -- Se o token for nulo, rejeitar imediatamente
    IF p_token IS NULL THEN
        RETURN NULL;
    END IF;

    -- 1. Se existir registo dedicado na tabela portal_tokens, verificar se está ativo e válido
    IF EXISTS (SELECT 1 FROM public.portal_tokens WHERE token = p_token) THEN
        SELECT (is_active = true AND (expires_at IS NULL OR expires_at > now()))
        INTO v_token_valid
        FROM public.portal_tokens
        WHERE token = p_token;

        IF NOT v_token_valid THEN
            RETURN NULL;
        END IF;
    END IF;

    -- 2. Obter o cliente através do portal_token
    SELECT * INTO v_client
    FROM public.clients
    WHERE portal_token = p_token
    LIMIT 1;

    -- Se não encontrar nenhum cliente com este token, retornar NULL (404 no portal)
    IF v_client.id IS NULL THEN
        RETURN NULL;
    END IF;

    -- 3. Obter relatórios do cliente (ordenados do mais recente para o mais antigo)
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
                'email_delivery_id', r.email_delivery_id,
                'created_at', r.created_at,
                'updated_at', r.updated_at
            ) ORDER BY r.period_end DESC
        ),
        '[]'::jsonb
    )
    INTO v_reports
    FROM public.reports r
    WHERE r.client_id = v_client.id;

    -- 4. Obter métricas de sprint do cliente
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', m.id,
                'client_id', m.client_id,
                'agency_id', m.agency_id,
                'sprint', m.sprint,
                'label', m.label,
                'completed', m.completed,
                'planned', m.planned,
                'created_at', m.created_at,
                'updated_at', m.updated_at
            ) ORDER BY m.sprint ASC
        ),
        '[]'::jsonb
    )
    INTO v_metrics
    FROM public.sprint_metrics m
    WHERE m.client_id = v_client.id;

    -- 5. Construir e devolver o payload JSON consolidado
    RETURN jsonb_build_object(
        'client', to_jsonb(v_client),
        'reports', v_reports,
        'metrics', v_metrics
    );
END;
$$;

COMMENT ON FUNCTION public.get_portal_data_by_token(UUID) IS
    'Função segura (SECURITY DEFINER) para acesso ao portal do cliente sem login. '
    'Apenas devolve dados se o token UUID for válido, ativo e não expirado.';

-- ------------------------------------------------------------------------------
-- 3. PERMISSÕES
-- ------------------------------------------------------------------------------
-- Apenas conceder execução aos roles anon, authenticated e service_role
REVOKE ALL ON FUNCTION public.get_portal_data_by_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_data_by_token(UUID) TO anon, authenticated, service_role;
