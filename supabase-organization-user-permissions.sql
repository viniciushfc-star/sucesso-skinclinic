-- Overrides de permissão por usuário (tela Equipe → configurar permissões).
-- Usado por permissions.service.js e core/permissions.js.
-- Rode após supabase-rls-organizations.sql (depende de organization_users).

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

COMMENT ON TABLE public.organization_user_permissions IS 'Overrides de permissão por usuário na org (tela de permissões da equipe).';

ALTER TABLE public.organization_user_permissions ENABLE ROW LEVEL SECURITY;

-- Leitura: membros da org podem ver overrides da própria org.
DROP POLICY IF EXISTS "org members read organization_user_permissions" ON public.organization_user_permissions;
CREATE POLICY "org members read organization_user_permissions" ON public.organization_user_permissions
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- Escrita: apenas master ou gestor da org pode inserir/atualizar/remover.
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
