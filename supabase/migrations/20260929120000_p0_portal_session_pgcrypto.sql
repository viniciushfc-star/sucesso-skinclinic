-- Token de sessão do portal: gen_random_bytes vive em extensions, não em public.
-- Cole o equivalente em supabase-criar-create-client-portal-session.sql se o live ainda 404.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.create_client_portal_session(p_org_id uuid, p_client_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_token text;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_users
    WHERE org_id = p_org_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Sem permissao nesta organizacao';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = p_client_id AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Cliente nao encontrado';
  END IF;

  UPDATE public.client_sessions
  SET expires_at = now()
  WHERE org_id = p_org_id AND client_id = p_client_id AND expires_at > now();

  v_token := gen_random_uuid()::text || '-' || encode(extensions.gen_random_bytes(12), 'hex');

  INSERT INTO public.client_sessions (org_id, client_id, token, expires_at)
  VALUES (p_org_id, p_client_id, v_token, now() + interval '30 days');

  RETURN v_token;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.create_client_portal_session(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.create_client_portal_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_client_portal_session(uuid, uuid) TO service_role;
