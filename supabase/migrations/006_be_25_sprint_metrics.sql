-- ==============================================================================
-- ClientPulse AI — Cálculo e Gestão de Sprint Metrics
-- Migration: 006_be_25_sprint_metrics.sql
-- Issue: [BE-25] [P1] [M] Calcular e guardar sprint_metrics #45
-- Sprint: Sprint 3 — Automação, segurança, teste real e entrega (11 - 17 Nov)
--
-- DESCRIÇÃO:
-- 1. Garante unicidade de (client_id, sprint) na tabela public.sprint_metrics
--    permitindo UPSERT seguro a cada sincronização.
-- 2. Trigger automático em public.reports: a cada novo relatório ou atualização
--    de raw_github_data, calcula automaticamente as métricas de tarefas
--    (concluídas e planeadas) e guarda/atualiza na tabela sprint_metrics.
-- 3. Trigger automático em public.report_tasks: quando tarefas granulares são
--    inseridas ou atualizadas, recalcula e sincroniza a sprint_metrics correspondente.
-- 4. Função RPC public.sync_client_sprint_metrics(UUID): permite recalcular e sincronizar
--    todas as métricas de um cliente a partir do histórico de relatórios.
-- 5. Backfill inicial: recalcula métricas para relatórios já existentes.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UNICIDADE (client_id, sprint)
-- ------------------------------------------------------------------------------
-- Remover eventuais duplicados anteriores antes de aplicar a restrição única
DELETE FROM public.sprint_metrics a USING public.sprint_metrics b
WHERE a.id < b.id
  AND a.client_id = b.client_id
  AND a.sprint = b.sprint;

ALTER TABLE public.sprint_metrics
DROP CONSTRAINT IF EXISTS sprint_metrics_client_sprint_key;

ALTER TABLE public.sprint_metrics
ADD CONSTRAINT sprint_metrics_client_sprint_key UNIQUE (client_id, sprint);

-- ------------------------------------------------------------------------------
-- 2. TRIGGER: Atualização automática a partir de public.reports
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_sprint_metrics_from_report()
RETURNS TRIGGER AS $$
DECLARE
    v_week INT;
    v_sprint TEXT;
    v_label TEXT;
    v_completed INT := 0;
    v_planned INT := 0;
BEGIN
    -- Se não houver data de fim de período, não é possível derivar a semana
    IF NEW.period_end IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calcular semana ISO a partir de period_end
    v_week := to_char(NEW.period_end, 'IW')::INT;
    v_sprint := 'S' || v_week::TEXT;
    v_label := 'Semana ' || v_week::TEXT;

    -- 1. Extrair contagem se raw_github_data for array de itens
    IF NEW.raw_github_data IS NOT NULL AND jsonb_typeof(NEW.raw_github_data) = 'array' THEN
        v_planned := jsonb_array_length(NEW.raw_github_data);
        SELECT COUNT(*) INTO v_completed
        FROM jsonb_array_elements(NEW.raw_github_data) AS elem
        WHERE LOWER(COALESCE(elem->>'statusCategory', elem->>'status', '')) = 'done';

    -- 2. Extrair contagem se raw_github_data for objeto com tasks_completed/tasks_planned
    ELSIF NEW.raw_github_data IS NOT NULL AND jsonb_typeof(NEW.raw_github_data) = 'object' THEN
        v_completed := COALESCE((NEW.raw_github_data->>'tasks_completed')::INT, 0);
        v_planned := COALESCE((NEW.raw_github_data->>'tasks_planned')::INT, 0);
    END IF;

    -- 3. Fallback: Se não encontrou contagens em raw_github_data, verificar report_tasks
    IF v_planned = 0 THEN
        SELECT
            COUNT(*) FILTER (WHERE status_category = 'done'),
            COUNT(*)
        INTO v_completed, v_planned
        FROM public.report_tasks
        WHERE report_id = NEW.id;
    END IF;

    -- 4. Fallback: Se ainda for 0, contar itens da lista summary_done
    IF v_planned = 0 AND NEW.summary_done IS NOT NULL AND trim(NEW.summary_done) != '' THEN
        v_completed := array_length(regexp_split_to_array(trim(NEW.summary_done), E'\n+'), 1);
        v_planned := v_completed;
    END IF;

    -- Guardar/Atualizar na tabela sprint_metrics
    INSERT INTO public.sprint_metrics (
        client_id,
        agency_id,
        sprint,
        label,
        completed,
        planned,
        updated_at
    )
    VALUES (
        NEW.client_id,
        NEW.agency_id,
        v_sprint,
        v_label,
        v_completed,
        v_planned,
        now()
    )
    ON CONFLICT (client_id, sprint)
    DO UPDATE SET
        completed = EXCLUDED.completed,
        planned = EXCLUDED.planned,
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_reports_calculate_sprint_metrics ON public.reports;
CREATE TRIGGER trigger_reports_calculate_sprint_metrics
    AFTER INSERT OR UPDATE OF raw_github_data, period_end, status
    ON public.reports
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_sprint_metrics_from_report();

-- ------------------------------------------------------------------------------
-- 3. TRIGGER: Atualização automática a partir de public.report_tasks
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_sprint_metrics_from_tasks()
RETURNS TRIGGER AS $$
DECLARE
    v_report RECORD;
    v_week INT;
    v_sprint TEXT;
    v_label TEXT;
    v_completed INT := 0;
    v_planned INT := 0;
BEGIN
    SELECT * INTO v_report FROM public.reports WHERE id = NEW.report_id;
    IF v_report.id IS NOT NULL AND v_report.period_end IS NOT NULL THEN
        v_week := to_char(v_report.period_end, 'IW')::INT;
        v_sprint := 'S' || v_week::TEXT;
        v_label := 'Semana ' || v_week::TEXT;

        SELECT
            COUNT(*) FILTER (WHERE status_category = 'done'),
            COUNT(*)
        INTO v_completed, v_planned
        FROM public.report_tasks
        WHERE report_id = v_report.id;

        IF v_planned > 0 THEN
            INSERT INTO public.sprint_metrics (
                client_id,
                agency_id,
                sprint,
                label,
                completed,
                planned,
                updated_at
            )
            VALUES (
                v_report.client_id,
                v_report.agency_id,
                v_sprint,
                v_label,
                v_completed,
                v_planned,
                now()
            )
            ON CONFLICT (client_id, sprint)
            DO UPDATE SET
                completed = EXCLUDED.completed,
                planned = EXCLUDED.planned,
                updated_at = now();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_tasks_calculate_sprint_metrics ON public.report_tasks;
CREATE TRIGGER trigger_tasks_calculate_sprint_metrics
    AFTER INSERT OR UPDATE OF status_category
    ON public.report_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_sprint_metrics_from_tasks();

-- ------------------------------------------------------------------------------
-- 4. FUNÇÃO RPC: sync_client_sprint_metrics(UUID)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_client_sprint_metrics(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_r RECORD;
    v_synced_count INT := 0;
    v_result JSONB;
BEGIN
    IF p_client_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'client_id é obrigatório');
    END IF;

    -- Iterar por cada relatório do cliente e disparar o recálculo
    FOR v_r IN
        SELECT * FROM public.reports WHERE client_id = p_client_id ORDER BY period_end ASC
    LOOP
        PERFORM public.calculate_sprint_metrics_from_report_record(v_r);
        v_synced_count := v_synced_count + 1;
    END LOOP;

    -- Obter métricas consolidadas
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', m.id,
                'sprint', m.sprint,
                'label', m.label,
                'completed', m.completed,
                'planned', m.planned
            ) ORDER BY m.sprint ASC
        ),
        '[]'::jsonb
    )
    INTO v_result
    FROM public.sprint_metrics m
    WHERE m.client_id = p_client_id;

    RETURN jsonb_build_object(
        'success', true,
        'client_id', p_client_id,
        'reports_processed', v_synced_count,
        'metrics', v_result
    );
END;
$$;

-- Função auxiliar interna para processar um registo de relatório
CREATE OR REPLACE FUNCTION public.calculate_sprint_metrics_from_report_record(p_report public.reports)
RETURNS VOID AS $$
DECLARE
    v_week INT;
    v_sprint TEXT;
    v_label TEXT;
    v_completed INT := 0;
    v_planned INT := 0;
BEGIN
    IF p_report.period_end IS NULL THEN
        RETURN;
    END IF;

    v_week := to_char(p_report.period_end, 'IW')::INT;
    v_sprint := 'S' || v_week::TEXT;
    v_label := 'Semana ' || v_week::TEXT;

    IF p_report.raw_github_data IS NOT NULL AND jsonb_typeof(p_report.raw_github_data) = 'array' THEN
        v_planned := jsonb_array_length(p_report.raw_github_data);
        SELECT COUNT(*) INTO v_completed
        FROM jsonb_array_elements(p_report.raw_github_data) AS elem
        WHERE LOWER(COALESCE(elem->>'statusCategory', elem->>'status', '')) = 'done';
    ELSIF p_report.raw_github_data IS NOT NULL AND jsonb_typeof(p_report.raw_github_data) = 'object' THEN
        v_completed := COALESCE((p_report.raw_github_data->>'tasks_completed')::INT, 0);
        v_planned := COALESCE((p_report.raw_github_data->>'tasks_planned')::INT, 0);
    END IF;

    IF v_planned = 0 THEN
        SELECT
            COUNT(*) FILTER (WHERE status_category = 'done'),
            COUNT(*)
        INTO v_completed, v_planned
        FROM public.report_tasks
        WHERE report_id = p_report.id;
    END IF;

    IF v_planned = 0 AND p_report.summary_done IS NOT NULL AND trim(p_report.summary_done) != '' THEN
        v_completed := array_length(regexp_split_to_array(trim(p_report.summary_done), E'\n+'), 1);
        v_planned := v_completed;
    END IF;

    INSERT INTO public.sprint_metrics (
        client_id, agency_id, sprint, label, completed, planned, updated_at
    )
    VALUES (
        p_report.client_id, p_report.agency_id, v_sprint, v_label, v_completed, v_planned, now()
    )
    ON CONFLICT (client_id, sprint)
    DO UPDATE SET
        completed = EXCLUDED.completed,
        planned = EXCLUDED.planned,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.sync_client_sprint_metrics(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. BACKFILL: Recalcular métricas para relatórios existentes na base de dados
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT * FROM public.reports LOOP
        PERFORM public.calculate_sprint_metrics_from_report_record(r);
    END LOOP;
END $$;
