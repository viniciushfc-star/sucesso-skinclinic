-- P0: audit_logs SELECT quebrava com current_setting('app.org_id').
-- Mesmo conteúdo de supabase-audit-logs-rls-fix.sql, versionado em migrations.

DROP POLICY IF EXISTS "audit_logs_select_org" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can read own org audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Org members can read audit_logs" ON public.audit_logs;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_org"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "audit_logs_insert_org" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_org"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );
