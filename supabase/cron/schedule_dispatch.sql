-- ==============================================================================
-- ClientPulse AI — Script de Configuração do Agendador (pg_cron + pg_net)
-- Ficheiro: supabase/cron/schedule_dispatch.sql
--
-- NOTA IMPORTANTE:
-- Este script NÃO é uma migração automática porque contém segredos e definições
-- específicas do ambiente de produção. Deve ser executado manualmente no SQL Editor
-- do painel Supabase pelo administrador do projeto.
--
-- INSTRUÇÕES DE EXECUÇÃO:
-- 1. Acede ao painel do Supabase: Dashboard -> SQL Editor
-- 2. Regista o segredo no Supabase Vault (se ainda não existir):
--      SELECT vault.create_secret('O_TEU_SCHEDULED_FUNCTION_SECRET', 'scheduled_function_secret');
-- 3. Substitui '<PROJECT_REF>' pelo id do teu projeto Supabase (ex: rewurbzemhydcqhmornx).
-- 4. Executa este script no SQL Editor.
-- ==============================================================================

-- 1. Ativar as extensões necessárias caso ainda não estejam ativas
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Remover agendamento anterior para evitar duplicação de jobs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-reports-hourly') THEN
        PERFORM cron.unschedule('dispatch-reports-hourly');
    END IF;
END $$;

-- 3. Agendar o job horário (minuto 0 de cada hora UTC)
-- Lê o segredo de forma segura a partir do Supabase Vault e invoca a Edge Function
SELECT cron.schedule(
    'dispatch-reports-hourly',
    '0 * * * *', -- A cada hora certa (ex: 09:00 UTC, 10:00 UTC, etc.)
    $$
    DO $$
    DECLARE
        v_secret text;
    BEGIN
        -- Obter o segredo cifrado no Supabase Vault
        SELECT decrypted_secret INTO v_secret
        FROM vault.decrypted_secrets
        WHERE name = 'scheduled_function_secret'
        LIMIT 1;

        IF v_secret IS NOT NULL THEN
            PERFORM net.http_post(
                url := 'https://<PROJECT_REF>.supabase.co/functions/v1/dispatch-scheduled-reports',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'X-Scheduled-Secret', v_secret
                ),
                body := '{}'::jsonb
            );
        ELSE
            RAISE WARNING 'Segredo "scheduled_function_secret" não encontrado em vault.decrypted_secrets';
        END IF;
    END;
    $$;
    $$
);

-- 4. Consultas para verificação do estado do agendamento
-- Para listar o job agendado:
--   SELECT * FROM cron.job;
--
-- Para consultar os últimos 5 registos de execução:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
