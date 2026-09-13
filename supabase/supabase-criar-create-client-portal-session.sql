-- ============================================================
-- Cria APENAS a função create_client_portal_session
-- Use se o app ainda retornar 404 ao gerar link do portal.
--
-- IMPORTANTE: Execute no mesmo projeto Supabase que o app usa.
-- (URL do app: ipaayevpoqllucltvuhj.supabase.co)
-- Supabase Dashboard → projeto correto → SQL Editor → New query
-- ============================================================

-- Garantir que a tabela client_sessions existe
CREATE TABLE IF NOT EXISTS public.client_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Criar a função (substitui se já existir)
CREATE OR REPLACE FUNCTION public.create_client_portal_session(p_org_id uuid, p_client_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  v_token := gen_random_uuid()::text || '-' || encode(gen_random_bytes(12), 'hex');

  INSERT INTO public.client_sessions (org_id, client_id, token, expires_at)
  VALUES (p_org_id, p_client_id, v_token, now() + interval '30 days');

  RETURN v_token;
END;
$func$;

-- Obrigatório: permitir que a API do Supabase (anon + authenticated) execute a função
GRANT EXECUTE ON FUNCTION public.create_client_portal_session(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.create_client_portal_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_client_portal_session(uuid, uuid) TO service_role;

-- Conferir: deve listar a função no schema public
SELECT routine_schema, routine_name, routine_type
  FROM information_schema.routines
  WHERE routine_name = 'create_client_portal_session';

-- Se aparecer 1 linha (public | create_client_portal_session | FUNCTION), está criada.
