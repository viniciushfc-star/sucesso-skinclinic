-- Fase 0: criar clínica (onboarding) sem mascarar isolamento.
-- RPC SECURITY DEFINER só cria org do auth.uid() + vínculo master dele.
-- Policies de INSERT/SELECT do dono permitem o fallback direto se a RPC falhar.
-- NÃO reabre INSERT em organization_users para qualquer org (P0 permanece).

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can create organization" ON public.organizations;
CREATE POLICY "authenticated can create organization"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "owner can read own organization" ON public.organizations;
CREATE POLICY "owner can read own organization"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "user can read organizations they belong to" ON public.organizations;
CREATE POLICY "user can read organizations they belong to"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT org_id
      FROM public.organization_users
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "user can read own organization memberships" ON public.organization_users;
CREATE POLICY "user can read own organization memberships"
  ON public.organization_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Mantém o P0: só dono (master/gestor) ou convite pendente.
DROP POLICY IF EXISTS "User can create own organization membership" ON public.organization_users;
DROP POLICY IF EXISTS "user can create own org membership" ON public.organization_users;
DROP POLICY IF EXISTS "membership insert owner or invitee" ON public.organization_users;
CREATE POLICY "membership insert owner or invitee"
  ON public.organization_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (
        EXISTS (
          SELECT 1 FROM public.organizations o
          WHERE o.id = organization_users.org_id
            AND o.owner_id = auth.uid()
        )
        AND role IN ('master', 'gestor')
      )
      OR EXISTS (
        SELECT 1 FROM public.organization_invites i
        WHERE i.org_id = organization_users.org_id
          AND i.status = 'pending'
          AND lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          AND i.role = organization_users.role
      )
    )
  );

CREATE OR REPLACE FUNCTION public.create_clinic(p_name text)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  org public.organizations;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  p_name := nullif(btrim(p_name), '');
  IF p_name IS NULL THEN
    RAISE EXCEPTION 'nome obrigatório';
  END IF;

  INSERT INTO public.organizations (name, owner_id)
  VALUES (p_name, uid)
  RETURNING * INTO org;

  INSERT INTO public.organization_users (org_id, user_id, role)
  VALUES (org.id, uid, 'master');

  RETURN org;
END;
$$;

REVOKE ALL ON FUNCTION public.create_clinic(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_clinic(text) TO authenticated;
