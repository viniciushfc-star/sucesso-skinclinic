-- Login da paciente no portal (e-mail + senha). NÃO é o login da equipe.
-- Cole no SQL Editor. Sem isso, o formulário de login avisa para usar o link.
-- O link da ficha continua valendo.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.client_sessions ADD COLUMN IF NOT EXISTS token_hash text;

CREATE TABLE IF NOT EXISTS public.client_portal_logins (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  email_norm text NOT NULL,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_logins_org_email
  ON public.client_portal_logins (org_id, email_norm);

ALTER TABLE public.client_portal_logins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_portal_logins staff none" ON public.client_portal_logins;
-- Sem policy de SELECT para authenticated: hash não vai para o painel da clínica.
-- Staff não lê senha. Portal só via RPC SECURITY DEFINER.

REVOKE ALL ON public.client_portal_logins FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_client_portal_password(p_token text, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_client uuid;
  v_org uuid;
  v_email text;
  v_pass text;
BEGIN
  v_pass := trim(coalesce(p_password, ''));
  IF length(v_pass) < 8 OR length(v_pass) > 72 OR v_pass ~ '\s' THEN
    RAISE EXCEPTION 'Senha precisa ter 8 a 72 caracteres, sem espaço.';
  END IF;

  SELECT s.client_id, s.org_id INTO v_client, v_org
  FROM public.get_client_session_by_token(p_token) AS s
  LIMIT 1;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida ou expirada';
  END IF;

  SELECT lower(trim(c.email)) INTO v_email
  FROM public.clients c
  WHERE c.id = v_client AND c.org_id = v_org;
  IF v_email IS NULL OR v_email = '' OR v_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'Informe um e-mail no cadastro para criar a senha.';
  END IF;

  INSERT INTO public.client_portal_logins (client_id, org_id, email_norm, password_hash, updated_at)
  VALUES (v_client, v_org, v_email, extensions.crypt(v_pass, extensions.gen_salt('bf')), now())
  ON CONFLICT (client_id) DO UPDATE SET
    org_id = excluded.org_id,
    email_norm = excluded.email_norm,
    password_hash = excluded.password_hash,
    updated_at = now();

  RETURN true;
END;
$func$;

CREATE OR REPLACE FUNCTION public.login_client_portal(p_email text, p_password text)
RETURNS TABLE (token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_email text;
  v_pass text;
  v_client uuid;
  v_org uuid;
  v_hits int := 0;
  v_token text;
  v_hash text;
  r record;
BEGIN
  v_email := lower(trim(coalesce(p_email, '')));
  v_pass := coalesce(p_password, '');
  IF v_email = '' OR v_email NOT LIKE '%@%' OR length(v_pass) < 8 THEN
    RAISE EXCEPTION 'E-mail ou senha nao conferem.';
  END IF;

  FOR r IN
    SELECT l.client_id, l.org_id, l.password_hash
    FROM public.client_portal_logins l
    JOIN public.clients c ON c.id = l.client_id AND c.org_id = l.org_id
    WHERE l.email_norm = v_email
  LOOP
    IF r.password_hash = extensions.crypt(v_pass, r.password_hash) THEN
      v_hits := v_hits + 1;
      v_client := r.client_id;
      v_org := r.org_id;
    END IF;
  END LOOP;

  IF v_hits = 0 THEN
    RAISE EXCEPTION 'E-mail ou senha nao conferem.';
  END IF;
  IF v_hits > 1 THEN
    RAISE EXCEPTION 'Este e-mail esta em mais de uma clinica. Use o link que voce recebeu.';
  END IF;

  UPDATE public.client_sessions
  SET expires_at = now()
  WHERE org_id = v_org AND client_id = v_client AND expires_at > now();

  v_token := gen_random_uuid()::text || '-' || encode(extensions.gen_random_bytes(12), 'hex');
  v_hash := encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'::text), 'hex');

  INSERT INTO public.client_sessions (org_id, client_id, token, token_hash, expires_at)
  VALUES (v_org, v_client, v_hash, v_hash, now() + interval '7 days');

  token := v_token;
  RETURN NEXT;
END;
$func$;

REVOKE ALL ON FUNCTION public.set_client_portal_password(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.login_client_portal(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_client_portal_password(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_client_portal(text, text) TO anon, authenticated;
