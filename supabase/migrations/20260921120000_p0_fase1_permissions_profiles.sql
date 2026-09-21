-- P0 Fase 1: catálogo de permissões (já esperado pelo app) + RLS de profiles.
-- IF NOT EXISTS: seguro se o live já tiver as tabelas (probe 2026-09-21: existem).
-- NÃO cria `appointments` nem `clientes` — canônico operacional é `agenda` e `clients`.
-- NÃO apaga tabelas legado (appointments=0 linhas; clientes tem linhas distintas — ver docs/FASE-1-BANCO-CICLO.md).

CREATE TABLE IF NOT EXISTS public.organization_user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_org_user_permissions_lookup
  ON public.organization_user_permissions(org_id, user_id);

ALTER TABLE public.organization_user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members read organization_user_permissions" ON public.organization_user_permissions;
CREATE POLICY "org members read organization_user_permissions" ON public.organization_user_permissions
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "master or gestor write organization_user_permissions" ON public.organization_user_permissions;
CREATE POLICY "master or gestor write organization_user_permissions" ON public.organization_user_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.org_id = organization_user_permissions.org_id
        AND ou.user_id = auth.uid()
        AND ou.role IN ('master', 'gestor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.org_id = organization_user_permissions.org_id
        AND ou.user_id = auth.uid()
        AND ou.role IN ('master', 'gestor')
    )
  );

-- profiles: deixar de ser SELECT USING (true) (vazamento entre orgs).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "users can read org profiles" ON public.profiles;
CREATE POLICY "users can read org profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR id IN (
      SELECT ou.user_id
      FROM public.organization_users ou
      WHERE ou.org_id IN (
        SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()
      )
    )
  );
