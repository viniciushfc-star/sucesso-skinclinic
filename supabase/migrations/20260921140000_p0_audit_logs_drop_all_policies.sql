-- O SQL anterior só dava DROP em 3 nomes. A policy que usa app.org_id
-- continua no live. Este bloco remove TODAS as policies de audit_logs
-- e recria SELECT/INSERT por membership.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_logs', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_org"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );

CREATE POLICY "audit_logs_insert_org"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );
