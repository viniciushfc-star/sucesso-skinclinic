-- FASE 4: audit_logs imutável para identidade; INSERT/UPDATE/DELETE só via service role.
-- Ok e estrela continuam possíveis nas colunas de acknowledge/star (API com JWT).
-- Cole no SQL Editor do Supabase.

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by_email text,
  ADD COLUMN IF NOT EXISTS starred_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS starred_at timestamptz,
  ADD COLUMN IF NOT EXISTS starred_by_email text;

DROP POLICY IF EXISTS "audit_logs_insert_org" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_acknowledge" ON public.audit_logs;

REVOKE INSERT ON TABLE public.audit_logs FROM PUBLIC;
REVOKE INSERT ON TABLE public.audit_logs FROM anon;
REVOKE INSERT ON TABLE public.audit_logs FROM authenticated;
REVOKE UPDATE ON TABLE public.audit_logs FROM PUBLIC;
REVOKE UPDATE ON TABLE public.audit_logs FROM anon;
REVOKE UPDATE ON TABLE public.audit_logs FROM authenticated;
REVOKE DELETE ON TABLE public.audit_logs FROM PUBLIC;
REVOKE DELETE ON TABLE public.audit_logs FROM anon;
REVOKE DELETE ON TABLE public.audit_logs FROM authenticated;

CREATE OR REPLACE FUNCTION public.audit_logs_protect()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_logs are immutable';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.org_id IS DISTINCT FROM OLD.org_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.user_email IS DISTINCT FROM OLD.user_email
      OR NEW.role_technical IS DISTINCT FROM OLD.role_technical
      OR NEW.job_title IS DISTINCT FROM OLD.job_title
      OR NEW.action IS DISTINCT FROM OLD.action
      OR NEW.table_name IS DISTINCT FROM OLD.table_name
      OR NEW.record_id IS DISTINCT FROM OLD.record_id
      OR NEW.permission_used IS DISTINCT FROM OLD.permission_used
      OR NEW.metadata IS DISTINCT FROM OLD.metadata
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'audit_logs identity is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_protect_trg ON public.audit_logs;
CREATE TRIGGER audit_logs_protect_trg
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE PROCEDURE public.audit_logs_protect();
