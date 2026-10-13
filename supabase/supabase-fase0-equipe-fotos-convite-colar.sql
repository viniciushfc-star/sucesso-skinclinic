-- Fase 0 leftover: convite de profissional, roster na agenda, fotos de evolução.
-- Cole no SQL Editor e Run. Idempotente.

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
ALTER TABLE public.organization_users
  ADD CONSTRAINT organization_users_role_check
  CHECK (role IN (
    'master', 'gestor', 'staff', 'viewer', 'funcionario', 'recepcao', 'profissional'
  ));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_invites'
  ) THEN
    ALTER TABLE public.organization_invites DROP CONSTRAINT IF EXISTS organization_invites_role_check;
    ALTER TABLE public.organization_invites
      ADD CONSTRAINT organization_invites_role_check
      CHECK (role IN (
        'master', 'gestor', 'staff', 'viewer', 'funcionario', 'recepcao', 'profissional'
      ));
    ALTER TABLE public.organization_invites ADD COLUMN IF NOT EXISTS token text;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.org_ids_of_uid()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.organization_users WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.org_ids_of_uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_ids_of_uid() TO authenticated;

DROP POLICY IF EXISTS "User can read own organization memberships" ON public.organization_users;
DROP POLICY IF EXISTS "user can read own organization memberships" ON public.organization_users;
DROP POLICY IF EXISTS "org members read roster" ON public.organization_users;

CREATE POLICY "org members read roster"
  ON public.organization_users
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT public.org_ids_of_uid()));

CREATE TABLE IF NOT EXISTS public.client_evolution_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  taken_at date NOT NULL,
  photo_url text NOT NULL,
  type text NOT NULL DEFAULT 'antes' CHECK (type IN ('antes', 'depois')),
  procedure_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_evolution_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members client_evolution_photos" ON public.client_evolution_photos;
CREATE POLICY "Org members client_evolution_photos"
  ON public.client_evolution_photos FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
