-- ==============================================================================
-- ClientPulse AI — Schema Migration: Restrict PAT Token Access
-- Migration: 010_restrict_pat_access.sql
-- Issue: [BE-05] / [BE-09] Segurança e Minimização de Dados
--
-- Impede que utilizadores autenticados leiam diretamente 'pat_token' ou
-- 'pat_token_encrypted' a partir do browser/frontend.
-- Apenas metadados não sensíveis (github_username, is_valid, scopes, etc.)
-- são selecionáveis pelo role 'authenticated'.
-- As Edge Functions continuam a aceder com 'service_role' para cifragem/decifragem.
-- ==============================================================================

-- 1. Revogar SELECT total na tabela para authenticated
REVOKE SELECT ON public.github_integrations FROM authenticated;

-- 2. Conceder SELECT apenas nas colunas não sensíveis (exclui pat_token e pat_token_encrypted)
GRANT SELECT (
    id,
    agency_id,
    github_username,
    is_valid,
    last_synced_at,
    created_at
) ON public.github_integrations TO authenticated;

-- 3. Conceder permissões para inserção e atualização de integrações
GRANT INSERT (
    agency_id,
    pat_token,
    pat_token_encrypted,
    github_username,
    is_valid,
    last_synced_at
) ON public.github_integrations TO authenticated;

GRANT UPDATE (
    pat_token,
    pat_token_encrypted,
    github_username,
    is_valid,
    last_synced_at
) ON public.github_integrations TO authenticated;

GRANT DELETE ON public.github_integrations TO authenticated;
