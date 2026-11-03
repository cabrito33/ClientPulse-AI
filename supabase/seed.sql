-- ==============================================================================
-- ClientPulse AI — Complete Test Seed Data (Issue #15 BE-01)
-- File: supabase/seed.sql
--
-- PURPOSE:
-- Populates demo data matching the frontend mock state:
--   - 1 Agency Workspace + 1 Profile
--   - 4 Clients: Atelier Mira, Clínica Vitalis, Maré Surf, Fundação Ática
--   - Portal Tokens with active status and direct access links
--   - Weekly Reports in 3 executive blocks (Done, Blockers, Next Steps)
--   - Sprint Velocity Metrics (Sprints S36 to S42)
--   - Delivery Logs (Resend audit logs)
--
-- HOW TO RUN IN SUPABASE SQL EDITOR:
-- Just paste and click "Run". It automatically targets the first user in auth.users
-- (or creates a fallback agency if run before any user signs up).
-- ==============================================================================

DO $$
DECLARE
    v_user_id UUID;
    v_agency_id UUID;
    v_profile_id UUID;
    
    -- Client IDs
    v_client_mira UUID;
    v_client_vitalis UUID;
    v_client_surf UUID;
    v_client_atica UUID;

    -- Report IDs
    v_report_mira UUID;
    v_report_vitalis UUID;
BEGIN
    -- 1. Obtain user_id (first user or generate placeholder)
    SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Nenhum utilizador encontrado em auth.users. Cria um utilizador no painel Auth antes de correr o seed.';
        RETURN;
    END IF;

    -- 2. Ensure Agency exists
    SELECT id INTO v_agency_id FROM public.agencies WHERE user_id = v_user_id LIMIT 1;
    IF v_agency_id IS NULL THEN
        INSERT INTO public.agencies (user_id, name)
        VALUES (v_user_id, 'Agência Web Inovação')
        RETURNING id INTO v_agency_id;
    END IF;

    -- 3. Ensure Profile exists
    INSERT INTO public.profiles (id, agency_id, full_name, email, role)
    VALUES (v_user_id, v_agency_id, 'Diogo Cosme', 'diogo.cosme@iscte.pt', 'owner')
    ON CONFLICT (id) DO UPDATE 
    SET agency_id = v_agency_id, full_name = 'Diogo Cosme';

    -- 4. Insert Clients
    -- Client 1: Atelier Mira
    INSERT INTO public.clients (
        agency_id, name, company_name, email, communication_tone, language,
        github_project_id, github_project_owner, github_project_type,
        schedule_day_of_week, schedule_hour_utc, auto_send_enabled,
        portal_token
    ) VALUES (
        v_agency_id, 'Inês Mira', 'Atelier Mira', 'ines@ateliermira.pt', 'executivo', 'pt',
        '1', 'cabrito33', 'user', 5, 9, false,
        '11111111-1111-4111-a111-111111111111'
    )
    ON CONFLICT (portal_token) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_client_mira;

    -- Client 2: Clínica Vitalis
    INSERT INTO public.clients (
        agency_id, name, company_name, email, communication_tone, language,
        github_project_id, github_project_owner, github_project_type,
        schedule_day_of_week, schedule_hour_utc, auto_send_enabled,
        portal_token
    ) VALUES (
        v_agency_id, 'Dr. Fernando Santos', 'Clínica Vitalis', 'fsantos@vitalis.pt', 'formal', 'pt',
        '2', 'cabrito33', 'organization', 5, 10, true,
        '22222222-2222-4222-a222-222222222222'
    )
    ON CONFLICT (portal_token) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_client_vitalis;

    -- Client 3: Maré Surf Camp
    INSERT INTO public.clients (
        agency_id, name, company_name, email, communication_tone, language,
        github_project_id, github_project_owner, github_project_type,
        schedule_day_of_week, schedule_hour_utc, auto_send_enabled,
        portal_token
    ) VALUES (
        v_agency_id, 'Tiago Ramos', 'Maré Surf Camp', 'tiago@maresurfcamp.com', 'descontraido', 'pt',
        '3', 'cabrito33', 'user', 5, 14, false,
        '33333333-3333-4333-a333-333333333333'
    )
    ON CONFLICT (portal_token) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_client_surf;

    -- Client 4: Fundação Ática
    INSERT INTO public.clients (
        agency_id, name, company_name, email, communication_tone, language,
        github_project_id, github_project_owner, github_project_type,
        schedule_day_of_week, schedule_hour_utc, auto_send_enabled,
        portal_token
    ) VALUES (
        v_agency_id, 'Sofia Brandão', 'Fundação Ática', 'sofia@fundacaoatica.org', 'formal', 'en',
        '4', 'cabrito33', 'organization', 4, 16, false,
        '44444444-4444-4444-a444-444444444444'
    )
    ON CONFLICT (portal_token) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_client_atica;

    -- 5. Insert Portal Tokens
    INSERT INTO public.portal_tokens (client_id, agency_id, token, is_active, created_at)
    VALUES
        (v_client_mira, v_agency_id, '11111111-1111-4111-a111-111111111111', true, now()),
        (v_client_vitalis, v_agency_id, '22222222-2222-4222-a222-222222222222', true, now()),
        (v_client_surf, v_agency_id, '33333333-3333-4333-a333-333333333333', true, now()),
        (v_client_atica, v_agency_id, '44444444-4444-4444-a444-444444444444', true, now())
    ON CONFLICT (token) DO NOTHING;

    -- 6. Insert Sprint Metrics (S36 to S42)
    -- Atelier Mira
    INSERT INTO public.sprint_metrics (client_id, agency_id, sprint, label, completed, planned) VALUES
        (v_client_mira, v_agency_id, 'S36', 'Semana 36', 3, 6),
        (v_client_mira, v_agency_id, 'S37', 'Semana 37', 5, 7),
        (v_client_mira, v_agency_id, 'S38', 'Semana 38', 4, 6),
        (v_client_mira, v_agency_id, 'S39', 'Semana 39', 7, 8),
        (v_client_mira, v_agency_id, 'S40', 'Semana 40', 5, 7),
        (v_client_mira, v_agency_id, 'S41', 'Semana 41', 6, 8),
        (v_client_mira, v_agency_id, 'S42', 'Semana 42', 7, 9);

    -- Clínica Vitalis
    INSERT INTO public.sprint_metrics (client_id, agency_id, sprint, label, completed, planned) VALUES
        (v_client_vitalis, v_agency_id, 'S36', 'Semana 36', 6, 8),
        (v_client_vitalis, v_agency_id, 'S37', 'Semana 37', 7, 9),
        (v_client_vitalis, v_agency_id, 'S38', 'Semana 38', 5, 8),
        (v_client_vitalis, v_agency_id, 'S39', 'Semana 39', 9, 10),
        (v_client_vitalis, v_agency_id, 'S40', 'Semana 40', 7, 9),
        (v_client_vitalis, v_agency_id, 'S41', 'Semana 41', 8, 9),
        (v_client_vitalis, v_agency_id, 'S42', 'Semana 42', 9, 11);

    -- 7. Insert Reports
    -- Report 1: Atelier Mira (Sent)
    INSERT INTO public.reports (
        client_id, agency_id, status, period_start, period_end,
        summary_done, summary_blockers, summary_next_steps,
        sent_at, approved_at, email_delivery_id
    ) VALUES (
        v_client_mira, v_agency_id, 'sent',
        CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE,
        '• Concluída a integração com o formulário de contacto e disparo de e-mails.' || E'\n' ||
        '• Finalizada a página inicial responsiva com animações suaves.' || E'\n' ||
        '• Otimizadas as imagens do portfólio para tempos de carregamento inferiores a 1s.',
        '• Aguardamos a seleção final das 10 fotografias em alta resolução por parte da Inês.',
        '• Implementar os filtros dinâmicos na galeria de projetos.' || E'\n' ||
        '• Realizar testes de usabilidade em dispositivos móveis.',
        now() - INTERVAL '2 days', now() - INTERVAL '2 days', 're_mira_demo_101'
    ) RETURNING id INTO v_report_mira;

    -- Report 2: Clínica Vitalis (Pending Review / Draft)
    INSERT INTO public.reports (
        client_id, agency_id, status, period_start, period_end,
        summary_done, summary_blockers, summary_next_steps
    ) VALUES (
        v_client_vitalis, v_agency_id, 'draft',
        CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE,
        '• Concluído o módulo central de marcação de consultas online com confirmação por SMS.' || E'\n' ||
        '• Implementado o painel de médicos com sincronização de calendário Google/Outlook.' || E'\n' ||
        '• Cumpridas as diretrizes de privacidade e RGPD nos formulários de registo clínico.',
        '• Pendente a emissão do certificado digital de produção para o módulo de faturação.',
        '• Iniciar testes alfa com equipa médica e 5 pacientes voluntários.' || E'\n' ||
        '• Integração com o gateway de pagamentos Multibanco/MB WAY.',
    ) RETURNING id INTO v_report_vitalis;

    -- 8. Insert Delivery Logs
    INSERT INTO public.delivery_logs (
        report_id, client_id, agency_id, status, email_service,
        recipient_email, message_id, sent_at
    ) VALUES (
        v_report_mira, v_client_mira, v_agency_id, 'sent', 'resend',
        'ines@ateliermira.pt', 're_mira_demo_101', now() - INTERVAL '2 days'
    );

    RAISE NOTICE 'Seed concluído com sucesso! 4 clientes, tokens, métricas e relatórios inseridos.';
END $$;
