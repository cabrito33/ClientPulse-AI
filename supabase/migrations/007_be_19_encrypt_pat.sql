-- ==============================================================================
-- ClientPulse AI — Cifragem do PAT do GitHub em Repouso
-- Migration: 007_be_19_encrypt_pat.sql
-- Issue: [BE-19] [P1] [M] Cifrar PAT do GitHub em repouso #19
-- Sprint: Sprint 3 — Automação, segurança, teste real e entrega (11 - 17 Nov)
--
-- DESCRIÇÃO:
-- 1. Adiciona a coluna `pat_token_encrypted` à tabela `public.github_integrations`.
-- 2. Torna a coluna legada `pat_token` anulável (DROP NOT NULL) para permitir novas
--    inserções cifradas.
-- 3. Anula os dados existentes da coluna `pat_token` em claro por segurança.
--    (Os utilizadores de teste reintroduzem o PAT no assistente de onboarding).
-- ==============================================================================

-- 1. Adicionar coluna pat_token_encrypted
ALTER TABLE public.github_integrations
ADD COLUMN IF NOT EXISTS pat_token_encrypted TEXT;

COMMENT ON COLUMN public.github_integrations.pat_token_encrypted IS
    'GitHub Personal Access Token (PAT) cifrado em repouso com AES-GCM 256-bit no formato iv:ciphertext (base64)';

-- 2. Tornar pat_token anulável
ALTER TABLE public.github_integrations
ALTER COLUMN pat_token DROP NOT NULL;

-- 3. Anular dados em claro existentes na coluna legada
UPDATE public.github_integrations
SET pat_token = NULL
WHERE pat_token IS NOT NULL;

COMMENT ON COLUMN public.github_integrations.pat_token IS
    'Coluna legada em texto simples (DESCONTINUADA). Mantida como NULL para compatibilidade retroativa antes de drop definitivo.';
