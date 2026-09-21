-- P1-8: papéis recepção e profissional no CHECK de role.
-- Sem isso o convite falha se o banco só aceitar master|gestor|staff|viewer.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, t.relname AS tbl
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname IN ('organization_users', 'organization_invites')
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;
END $$;

ALTER TABLE public.organization_users
  DROP CONSTRAINT IF EXISTS organization_users_role_check;
ALTER TABLE public.organization_invites
  DROP CONSTRAINT IF EXISTS organization_invites_role_check;

ALTER TABLE public.organization_users
  ADD CONSTRAINT organization_users_role_check
  CHECK (role IN (
    'master', 'gestor', 'staff', 'viewer', 'funcionario', 'recepcao', 'profissional'
  ));

ALTER TABLE public.organization_invites
  ADD CONSTRAINT organization_invites_role_check
  CHECK (role IN (
    'master', 'gestor', 'staff', 'viewer', 'funcionario', 'recepcao', 'profissional'
  ));

COMMENT ON CONSTRAINT organization_users_role_check ON public.organization_users IS
  'P1-8: recepcao (frente) e profissional (clínica). staff continua o convite legado.';
