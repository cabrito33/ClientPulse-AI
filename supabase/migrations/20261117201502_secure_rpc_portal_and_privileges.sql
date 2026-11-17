-- SECURITY: protect tenant boundaries, publish SENT reports only, hide raw GitHub data.
CREATE OR REPLACE FUNCTION public.get_portal_data_by_token(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                'tasks_completed', (SELECT count(*) FROM public.report_tasks t WHERE t.report_id = r.id AND t.status_category = 'done'),
                'tasks_planned', (SELECT count(*) FROM public.report_tasks t WHERE t.report_id = r.id),
                'approved_at', r.approved_at,
                'sent_at', r.sent_at,
                'opened_at', r.opened_at,
                
                'created_at', r.created_at,
                'updated_at', r.updated_at
            ) ORDER BY r.period_end DESC
        ),
        '[]'::jsonb
    ) INTO v_reports
    FROM public.reports r
    WHERE r.client_id = v_client.id
      AND r.status = 'sent';

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
            
            'github_project_title', COALESCE(v_client.github_project_title, v_client.company_name, v_client.name),
            'github_project_id', v_client.github_project_id,
            
            'schedule_day_of_week', v_client.schedule_day_of_week,
            'schedule_hour_utc', v_client.schedule_hour_utc,
            'auto_send_enabled', v_client.auto_send_enabled,
            
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
$function$;
CREATE OR REPLACE FUNCTION public.check_portal_token_status(p_token uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        -- No fallback: missing portal_tokens records are always invalid.
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
$function$;
CREATE OR REPLACE FUNCTION public.sync_client_sprint_metrics(p_client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_r RECORD;
    v_synced_count INT := 0;
    v_result JSONB;
BEGIN
    -- All privileged reads/writes must be limited to the authenticated agency.
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.clients c
        JOIN public.agencies a ON a.id = c.agency_id
        WHERE c.id = p_client_id AND a.user_id = auth.uid()
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'forbidden');
    END IF;
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
$function$;
CREATE OR REPLACE FUNCTION public.record_portal_report_open(p_token uuid, p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE v_opened_at timestamptz;
BEGIN
  IF p_token IS NULL OR p_report_id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.reports r SET opened_at = COALESCE(r.opened_at, now())
  WHERE r.id = p_report_id AND r.status = 'sent'
    AND EXISTS (SELECT 1 FROM public.portal_tokens pt WHERE pt.token = p_token
                AND pt.client_id = r.client_id AND pt.is_active = true
                AND pt.revoked_at IS NULL AND pt.expires_at > now())
  RETURNING r.opened_at INTO v_opened_at;
  IF v_opened_at IS NULL THEN RETURN NULL; END IF;
  UPDATE public.delivery_logs SET opened_at = COALESCE(opened_at, v_opened_at)
   WHERE report_id = p_report_id;
  RETURN jsonb_build_object('opened_at', v_opened_at);
END $function$;
REVOKE EXECUTE ON FUNCTION public.calculate_sprint_metrics_from_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_sprint_metrics_from_report() TO service_role;
REVOKE EXECUTE ON FUNCTION public.calculate_sprint_metrics_from_report_record(public.reports) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_sprint_metrics_from_report_record(public.reports) TO service_role;
REVOKE EXECUTE ON FUNCTION public.calculate_sprint_metrics_from_tasks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_sprint_metrics_from_tasks() TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_portal_token_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_portal_token_status(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_my_agency_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_agency_id() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_portal_data_by_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_data_by_token(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
REVOKE EXECUTE ON FUNCTION public.log_client_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_client_audit() TO service_role;
REVOKE EXECUTE ON FUNCTION public.log_github_integration_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_github_integration_audit() TO service_role;
REVOKE EXECUTE ON FUNCTION public.log_portal_token_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_portal_token_audit() TO service_role;
REVOKE EXECUTE ON FUNCTION public.log_report_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_report_audit() TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_report_open(uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_report_open(uuid,timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.sync_client_sprint_metrics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_client_sprint_metrics(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_portal_report_open(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_portal_report_open(uuid,uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_data_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_portal_token_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_client_sprint_metrics(uuid) TO authenticated;
