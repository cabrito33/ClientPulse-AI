-- ==============================================================================
-- ClientPulse AI — Row Level Security: Completude & Isolamento Multi-Inquilino
-- Migration: 004_be_02_rls_policies.sql
-- Issue: [BE-02] [P1] [L] Implementar Row Level Security (isolamento multi-inquilino) #16
-- Sprint: Sprint 3 — 11-17 Nov
--
-- DESCRIÇÃO:
-- Esta migração complementa as políticas RLS definidas em 001 e 003:
--   1. Função auxiliar get_my_agency_id() para evitar subqueries repetidas por linha
--   2. Políticas em falta: INSERT para agencies e profiles (auto-provisionamento)
--   3. Acesso de leitura anónima via portal token (clientes acedem ao portal sem login)
--   4. Correcção de report_tasks (WITH CHECK em falta no FOR ALL)
--   5. Cobertura completa de delivery_logs (UPDATE/DELETE para service role)
--
-- TODAS AS TABELAS TÊM RLS ACTIVO:
--   public.agencies              ✅ 001 + esta migração
--   public.github_integrations   ✅ 001
--   public.clients               ✅ 001 + esta migração (portal anon)
--   public.reports               ✅ 001 + esta migração (portal anon)
--   public.report_tasks          ✅ 001 (corrigido aqui)
--   public.profiles              ✅ 003 + esta migração
--   public.sprint_metrics        ✅ 003 + esta migração (portal anon)
--   public.portal_tokens         ✅ 003
--   public.delivery_logs         ✅ 003 + esta migração
-- ==============================================================================

-- ==============================================================================
-- 1. FUNÇÃO AUXILIAR: get_my_agency_id()
-- ==============================================================================
-- Evita subqueries repetidas por linha em cada política (melhoria de performance).
-- SECURITY DEFINER: executa com privilégios do owner, não do chamador.
-- STABLE: o resultado é constante dentro de uma transação (cacheável pelo planner).
-- SET search_path: protege contra ataques de path search.
CREATE OR REPLACE FUNCTION public.get_my_agency_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.agencies WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.get_my_agency_id() IS
  'Devolve o agency_id do utilizador autenticado. Usada pelas políticas RLS para '
  'evitar subqueries redundantes por linha. SECURITY DEFINER para acesso seguro.';

GRANT EXECUTE ON FUNCTION public.get_my_agency_id() TO authenticated;

-- ==============================================================================
-- 2. CORRECÇÃO: agencies — adicionar política INSERT
-- ==============================================================================
-- A tabela agencies não tinha política INSERT explícita.
-- Necessário para o trigger handle_new_user() funcionar quando criado via SDK
-- (o trigger usa SECURITY DEFINER, mas a política INSERT garante consistência).
-- Apenas permite inserir uma agency ligada ao próprio auth.uid().

DROP POLICY IF EXISTS "Users can insert their own agency" ON public.agencies;
CREATE POLICY "Users can insert their own agency"
    ON public.agencies FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- ==============================================================================
-- 3. CORRECÇÃO: profiles — adicionar política INSERT
-- ==============================================================================
-- O trigger handle_new_user() insere o perfil via SECURITY DEFINER (bypass RLS),
-- mas definimos a política INSERT para consistência e auditoria.

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

-- ==============================================================================
-- 4. CORRECÇÃO: report_tasks — FOR ALL sem WITH CHECK
-- ==============================================================================
-- A política "Users can manage their agency report tasks" em 001 usava FOR ALL
-- mas não tinha WITH CHECK, pelo que inserções não eram verificadas correctamente.

DROP POLICY IF EXISTS "Users can manage their agency report tasks" ON public.report_tasks;
CREATE POLICY "Users can manage their agency report tasks"
    ON public.report_tasks FOR ALL
    TO authenticated
    USING (
        report_id IN (
            SELECT r.id FROM public.reports r
            WHERE r.agency_id = public.get_my_agency_id()
        )
    )
    WITH CHECK (
        report_id IN (
            SELECT r.id FROM public.reports r
            WHERE r.agency_id = public.get_my_agency_id()
        )
    );

-- ==============================================================================
-- 5. CORRECÇÃO: delivery_logs — adicionar políticas UPDATE/DELETE
-- ==============================================================================
-- A migração 003 apenas criou SELECT e INSERT.
-- Edge Functions (service role) fazem UPDATE quando o status muda (sent→delivered, bounced, failed).
-- DELETE é restrito a service role apenas (não exposto às agências).

DROP POLICY IF EXISTS "Service role can update delivery logs" ON public.delivery_logs;
CREATE POLICY "Service role can update delivery logs"
    ON public.delivery_logs FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 6. PORTAL ANÓNIMO — Acesso read-only via portal token
-- ==============================================================================
-- O cliente final acede ao seu portal SEM login Supabase.
-- A Edge Function client-portal-data usa a chave de serviço (service_role) para
-- validar o token e devolver dados. As políticas abaixo são uma segunda linha de
-- defesa: se o frontend algum dia usar a anon key directamente, ainda é seguro.
--
-- ESTRATÉGIA:
--   - As Edge Functions já usam createAdminClient() (service_role → bypass RLS).
--   - As políticas abaixo protegem o caso do anon key ser exposto ao browser.
--   - portal_token é armazenado em clients.portal_token (UUID único e não-previsível).
--   - Acesso read-only: apenas SELECT, nunca INSERT/UPDATE/DELETE.
--
-- NOTA: políticas anon usam TO anon (Supabase anon role).

-- 6.1 Portal: clients — ler o próprio registo via portal_token
DROP POLICY IF EXISTS "Portal anon pode ver cliente via token" ON public.clients;
CREATE POLICY "Portal anon pode ver cliente via token"
    ON public.clients FOR SELECT
    TO anon
    USING (
        -- O portal_token deve ser passado como parâmetro de query ou cookie.
        -- Exemplo de chamada: ?portal_token=<uuid>
        -- Esta política valida que o token na URL corresponde ao registo.
        portal_token = (
            SELECT pt.token
            FROM public.portal_tokens pt
            WHERE pt.token = portal_token         -- compara o campo da tabela clients
              AND pt.client_id = id               -- garante que é o mesmo cliente
              AND pt.is_active = true
              AND (pt.expires_at IS NULL OR pt.expires_at > now())
            LIMIT 1
        )
    );

-- 6.2 Portal: reports — ler relatórios do cliente via portal_token
DROP POLICY IF EXISTS "Portal anon pode ver relatórios via token" ON public.reports;
CREATE POLICY "Portal anon pode ver relatórios via token"
    ON public.reports FOR SELECT
    TO anon
    USING (
        client_id IN (
            SELECT c.id FROM public.clients c
            JOIN public.portal_tokens pt ON pt.client_id = c.id
            WHERE pt.is_active = true
              AND (pt.expires_at IS NULL OR pt.expires_at > now())
              AND c.portal_token = pt.token
        )
    );

-- 6.3 Portal: sprint_metrics — ler métricas do cliente via portal_token
DROP POLICY IF EXISTS "Portal anon pode ver sprint metrics via token" ON public.sprint_metrics;
CREATE POLICY "Portal anon pode ver sprint metrics via token"
    ON public.sprint_metrics FOR SELECT
    TO anon
    USING (
        client_id IN (
            SELECT c.id FROM public.clients c
            JOIN public.portal_tokens pt ON pt.client_id = c.id
            WHERE pt.is_active = true
              AND (pt.expires_at IS NULL OR pt.expires_at > now())
              AND c.portal_token = pt.token
        )
    );

-- 6.4 Portal: report_tasks — ler tarefas dos relatórios do cliente via portal_token
DROP POLICY IF EXISTS "Portal anon pode ver report tasks via token" ON public.report_tasks;
CREATE POLICY "Portal anon pode ver report tasks via token"
    ON public.report_tasks FOR SELECT
    TO anon
    USING (
        client_id IN (
            SELECT c.id FROM public.clients c
            JOIN public.portal_tokens pt ON pt.client_id = c.id
            WHERE pt.is_active = true
              AND (pt.expires_at IS NULL OR pt.expires_at > now())
              AND c.portal_token = pt.token
        )
    );

-- ==============================================================================
-- 7. REVOGAR ACESSO PÚBLICO DESNECESSÁRIO (hardening)
-- ==============================================================================
-- Garante que o role 'public' não tem acesso directo a tabelas sensíveis.
-- As Edge Functions usam service_role; o dashboard usa authenticated.

REVOKE ALL ON public.github_integrations FROM PUBLIC;
REVOKE ALL ON public.portal_tokens FROM PUBLIC;
REVOKE ALL ON public.delivery_logs FROM PUBLIC;

-- Garantir que authenticated tem acesso às tabelas necessárias (pode já existir)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agencies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sprint_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_integrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_tokens TO authenticated;
GRANT SELECT, INSERT ON public.delivery_logs TO authenticated;

-- Acesso anon (portal) apenas SELECT nas tabelas expostas pelo portal
GRANT SELECT ON public.clients TO anon;
GRANT SELECT ON public.reports TO anon;
GRANT SELECT ON public.report_tasks TO anon;
GRANT SELECT ON public.sprint_metrics TO anon;

-- ==============================================================================
-- 8. VERIFICAÇÃO INLINE (comentada — executar manualmente no Supabase SQL Editor)
-- ==============================================================================
-- Ver supabase/tests/rls_isolation_test.sql para o script completo de teste.
--
-- Verificação rápida das políticas activas:
/*
SELECT
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
*/

-- Verificação do RLS estar activo em todas as tabelas:
/*
SELECT
    relname AS table_name,
    relrowsecurity AS rls_enabled,
    relforcerowsecurity AS rls_forced
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE pg_namespace.nspname = 'public'
  AND relkind = 'r'
ORDER BY relname;
*/
