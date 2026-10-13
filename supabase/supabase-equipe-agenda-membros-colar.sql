-- Cole no SQL Editor do Supabase.
-- Sem isto a Agenda só mostra “Administrador” (o usuário logado).
-- A profissional convidada só aparece depois de aceitar o convite.

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

DROP POLICY IF EXISTS "users can read org profiles" ON public.profiles;
CREATE POLICY "users can read org profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR id IN (
      SELECT ou.user_id
      FROM public.organization_users ou
      WHERE ou.org_id IN (SELECT public.org_ids_of_uid())
    )
  );
