-- FK convite → clínica (PostgREST precisa disso para embed; o app já não depende do embed).
-- Não apaga dados. Cole no SQL Editor.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_invites' AND column_name = 'org_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'organization_invites'
      AND c.contype = 'f'
      AND c.confrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE public.organization_invites
      ADD CONSTRAINT organization_invites_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
