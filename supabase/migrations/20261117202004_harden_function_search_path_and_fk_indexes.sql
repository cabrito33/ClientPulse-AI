-- Defense in depth: stable function search_path and indexes for FK performance.
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.record_report_open(uuid, timestamptz) SET search_path = public;
CREATE INDEX IF NOT EXISTS idx_portal_tokens_agency_id ON public.portal_tokens (agency_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON public.audit_logs (actor_user_id);
