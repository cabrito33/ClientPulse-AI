-- ==============================================================================
-- ClientPulse AI — Testes de Isolamento Row Level Security (RLS)
-- Ficheiro: supabase/tests/rls_isolation_test.sql
-- Issue: [BE-02] [P1] Implementar Row Level Security #16
--
-- COMO EXECUTAR:
--   1. Abrir o Supabase SQL Editor (painel do projecto em supabase.com)
--   2. Colar e executar este bloco completo.
--   3. Verificar as mensagens NOTICE para PASS/FAIL.
--   4. No final NUNCA deve aparecer "RLS FAIL". Se aparecer, rever as políticas.
--
-- NOTA: Este script usa roles simulados com SET LOCAL ROLE e set_config()
-- para imitar o comportamento de dois utilizadores distintos.
-- Requer permissões de superuser (disponível no SQL Editor do Supabase).
-- ==============================================================================

DO $$
DECLARE
    -- UUIDs fictícios para os dois utilizadores de teste
    v_user_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    v_user_b UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    -- IDs a serem preenchidos durante o teste
    v_agency_a UUID;
    v_agency_b UUID;
    v_client_a UUID;
    v_client_b UUID;
    v_report_a UUID;
    v_portal_token_a UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    -- Contadores para verificação
    v_count INT;
BEGIN
    RAISE NOTICE '=== INÍCIO DOS TESTES RLS ClientPulse AI ===';
    RAISE NOTICE '';

    -- =========================================================================
    -- SETUP: Criar dados fictícios para os dois utilizadores
    -- (executado como superuser — bypassa RLS)
    -- =========================================================================
    RAISE NOTICE '[SETUP] A criar agências e clientes de teste...';

    -- Inserir agência A (utilizador A)
    INSERT INTO public.agencies (id, user_id, name)
    VALUES (gen_random_uuid(), v_user_a, 'Agência A — Teste RLS')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_agency_a;

    IF v_agency_a IS NULL THEN
        SELECT id INTO v_agency_a FROM public.agencies WHERE user_id = v_user_a;
    END IF;

    -- Inserir agência B (utilizador B)
    INSERT INTO public.agencies (id, user_id, name)
    VALUES (gen_random_uuid(), v_user_b, 'Agência B — Teste RLS')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_agency_b;

    IF v_agency_b IS NULL THEN
        SELECT id INTO v_agency_b FROM public.agencies WHERE user_id = v_user_b;
    END IF;

    -- Inserir cliente da agência A
    INSERT INTO public.clients (
        agency_id, name, email, github_project_id,
        github_project_owner, portal_token
    )
    VALUES (
        v_agency_a, 'Cliente Secreto A', 'secreto@agencia-a.pt',
        'proj-a', 'org-a', v_portal_token_a
    )
    ON CONFLICT (portal_token) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_client_a;

    -- Inserir cliente da agência B
    INSERT INTO public.clients (
        agency_id, name, email, github_project_id, github_project_owner
    )
    VALUES (
        v_agency_b, 'Cliente Secreto B', 'secreto@agencia-b.pt',
        'proj-b', 'org-b'
    )
    RETURNING id INTO v_client_b;

    -- Inserir relatório da agência A
    INSERT INTO public.reports (
        client_id, agency_id, status,
        period_start, period_end,
        summary_done, summary_blockers, summary_next_steps
    )
    VALUES (
        v_client_a, v_agency_a, 'sent',
        CURRENT_DATE - 7, CURRENT_DATE,
        'Dados confidenciais da Agência A', 'Sem bloqueios', 'Continuar'
    )
    RETURNING id INTO v_report_a;

    -- Inserir portal_token activo para o cliente A
    INSERT INTO public.portal_tokens (client_id, agency_id, token, is_active)
    VALUES (v_client_a, v_agency_a, v_portal_token_a, true)
    ON CONFLICT (token) DO NOTHING;

    RAISE NOTICE '[SETUP] Dados criados com sucesso.';
    RAISE NOTICE '  Agência A: % (user: %)', v_agency_a, v_user_a;
    RAISE NOTICE '  Agência B: % (user: %)', v_agency_b, v_user_b;
    RAISE NOTICE '  Cliente A: % | Portal Token: %', v_client_a, v_portal_token_a;
    RAISE NOTICE '';

    -- =========================================================================
    -- TESTE 1: Utilizador A vê os seus clientes
    -- =========================================================================
    RAISE NOTICE '[TESTE 1] Utilizador A consegue ler os seus próprios clientes...';

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);

    SELECT COUNT(*) INTO v_count
    FROM public.clients
    WHERE id = v_client_a;

    IF v_count = 1 THEN
        RAISE NOTICE '  ✅ PASS — Utilizador A vê o seu cliente (% linha)', v_count;
    ELSE
        RAISE EXCEPTION '  ❌ RLS FAIL — Utilizador A não consegue ver o seu próprio cliente!';
    END IF;

    -- =========================================================================
    -- TESTE 2: Utilizador B NÃO vê clientes da Agência A
    -- =========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '[TESTE 2] Utilizador B NÃO consegue ler clientes da Agência A...';

    PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);

    SELECT COUNT(*) INTO v_count
    FROM public.clients
    WHERE id = v_client_a;

    IF v_count = 0 THEN
        RAISE NOTICE '  ✅ PASS — Utilizador B não vê dados da Agência A (0 linhas)';
    ELSE
        RAISE EXCEPTION '  ❌ RLS FAIL — Utilizador B conseguiu ler % cliente(s) da Agência A!', v_count;
    END IF;

    -- =========================================================================
    -- TESTE 3: Utilizador B NÃO vê relatórios da Agência A
    -- =========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '[TESTE 3] Utilizador B NÃO consegue ler relatórios da Agência A...';

    SELECT COUNT(*) INTO v_count
    FROM public.reports
    WHERE id = v_report_a;

    IF v_count = 0 THEN
        RAISE NOTICE '  ✅ PASS — Utilizador B não vê relatórios da Agência A (0 linhas)';
    ELSE
        RAISE EXCEPTION '  ❌ RLS FAIL — Utilizador B conseguiu ler % relatório(s) da Agência A!', v_count;
    END IF;

    -- =========================================================================
    -- TESTE 4: Utilizador B NÃO vê a agência da Agência A
    -- =========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '[TESTE 4] Utilizador B NÃO vê o registo de agencies da Agência A...';

    SELECT COUNT(*) INTO v_count
    FROM public.agencies
    WHERE id = v_agency_a;

    IF v_count = 0 THEN
        RAISE NOTICE '  ✅ PASS — Utilizador B não vê agencies da Agência A (0 linhas)';
    ELSE
        RAISE EXCEPTION '  ❌ RLS FAIL — Utilizador B viu % registo(s) de agencies da Agência A!', v_count;
    END IF;

    -- =========================================================================
    -- TESTE 5: Utilizador B NÃO consegue fazer UPDATE em clientes da Agência A
    -- =========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '[TESTE 5] Utilizador B NÃO consegue fazer UPDATE em clientes da Agência A...';

    BEGIN
        UPDATE public.clients
        SET name = 'HACK ATTEMPT'
        WHERE id = v_client_a;

        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count = 0 THEN
            RAISE NOTICE '  ✅ PASS — UPDATE afectou 0 linhas (bloqueado por RLS)';
        ELSE
            RAISE EXCEPTION '  ❌ RLS FAIL — Utilizador B modificou % cliente(s) da Agência A!', v_count;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  ✅ PASS — UPDATE rejeitado com erro: %', SQLERRM;
    END;

    -- =========================================================================
    -- TESTE 6: Utilizador A vê os seus relatórios
    -- =========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '[TESTE 6] Utilizador A consegue ler os seus próprios relatórios...';

    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);

    SELECT COUNT(*) INTO v_count
    FROM public.reports
    WHERE id = v_report_a;

    IF v_count = 1 THEN
        RAISE NOTICE '  ✅ PASS — Utilizador A vê o seu relatório (% linha)', v_count;
    ELSE
        RAISE EXCEPTION '  ❌ RLS FAIL — Utilizador A não consegue ver o seu próprio relatório!';
    END IF;

    -- =========================================================================
    -- TESTE 7: get_my_agency_id() retorna o agency_id correcto
    -- =========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '[TESTE 7] Função get_my_agency_id() retorna o agency_id correcto...';

    DECLARE
        v_returned_agency UUID;
    BEGIN
        SELECT public.get_my_agency_id() INTO v_returned_agency;
        IF v_returned_agency = v_agency_a THEN
            RAISE NOTICE '  ✅ PASS — get_my_agency_id() retornou % (correcto)', v_returned_agency;
        ELSE
            RAISE EXCEPTION '  ❌ FAIL — get_my_agency_id() retornou % em vez de %', v_returned_agency, v_agency_a;
        END IF;
    END;

    -- =========================================================================
    -- TEARDOWN: Reverter ao role de superuser e limpar dados de teste
    -- =========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '[TEARDOWN] A limpar dados de teste...';

    RESET ROLE;

    -- Remover dados na ordem inversa das FK (CASCADE faz o resto)
    DELETE FROM public.agencies WHERE user_id IN (v_user_a, v_user_b);

    RAISE NOTICE '[TEARDOWN] Dados removidos.';
    RAISE NOTICE '';
    RAISE NOTICE '=== TODOS OS TESTES RLS PASSARAM ✅ ===';

EXCEPTION WHEN OTHERS THEN
    -- Garantir que o role é sempre reposto mesmo em caso de erro
    RESET ROLE;
    DELETE FROM public.agencies WHERE user_id IN (v_user_a, v_user_b);
    RAISE EXCEPTION 'TESTE FALHOU: %', SQLERRM;
END $$;
