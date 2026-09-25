-- Portal: digest do token vive em extensions, não em public.
-- Sem isso get_client_by_token / sessão / cadastro quebram com digest(bytea, unknown).
-- Cole no SQL Editor. Não apaga dados.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.get_client_session_by_token(p_token text)
RETURNS TABLE (client_id uuid, org_id uuid, expires_at timestamptz, registration_completed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN;
  END IF;

  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'::text), 'hex');

  UPDATE public.client_sessions
  SET last_used_at = now()
  WHERE revoked_at IS NULL
    AND expires_at > now()
    AND (token_hash = v_hash OR (token_hash IS NULL AND token = p_token));

  RETURN QUERY
  SELECT
    s.client_id,
    s.org_id,
    s.expires_at,
    c.registration_completed_at
  FROM public.client_sessions s
  JOIN public.clients c ON c.id = s.client_id AND c.org_id = s.org_id
  WHERE s.revoked_at IS NULL
    AND s.expires_at > now()
    AND (s.token_hash = v_hash OR (s.token_hash IS NULL AND s.token = p_token))
  LIMIT 1;
END;
$func$;

CREATE OR REPLACE FUNCTION public.get_client_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  name text,
  phone text,
  email text,
  cpf text,
  birth_date date,
  sex text,
  registration_completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_session RECORD;
  v_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN;
  END IF;
  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'::text), 'hex');
  SELECT s.client_id, s.org_id INTO v_session
  FROM public.client_sessions s
  WHERE s.revoked_at IS NULL
    AND s.expires_at > now()
    AND (s.token_hash = v_hash OR (s.token_hash IS NULL AND s.token = p_token))
  LIMIT 1;
  IF v_session.client_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.phone,
    c.email,
    CASE WHEN c.registration_completed_at IS NULL THEN c.cpf ELSE NULL END,
    c.birth_date::date,
    c.sex,
    c.registration_completed_at
  FROM public.clients c
  WHERE c.id = v_session.client_id AND c.org_id = v_session.org_id
  LIMIT 1;
END;
$func$;

CREATE OR REPLACE FUNCTION public.client_complete_registration(
  p_token text,
  p_name text,
  p_phone text,
  p_email text,
  p_birth_date date DEFAULT NULL,
  p_sex text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_consent_terms_accepted boolean DEFAULT false,
  p_consent_image_use boolean DEFAULT false,
  p_consent_terms_version text DEFAULT 'v1'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_session RECORD;
  v_client_id uuid;
  v_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token invalido';
  END IF;
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Nome e obrigatorio';
  END IF;
  IF (p_phone IS NULL OR trim(p_phone) = '') AND (p_email IS NULL OR trim(p_email) = '') THEN
    RAISE EXCEPTION 'Informe telefone ou e-mail';
  END IF;
  IF NOT (COALESCE(p_consent_terms_accepted, false)) THEN
    RAISE EXCEPTION 'E obrigatorio aceitar o Termo de Consentimento para continuar';
  END IF;

  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'::text), 'hex');
  SELECT s.client_id, s.org_id INTO v_session
  FROM public.client_sessions s
  WHERE s.revoked_at IS NULL
    AND s.expires_at > now()
    AND (s.token_hash = v_hash OR (s.token_hash IS NULL AND s.token = p_token))
  LIMIT 1;

  IF v_session.client_id IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida ou expirada';
  END IF;

  v_client_id := v_session.client_id;

  UPDATE public.clients
  SET
    name = trim(p_name),
    phone = nullif(trim(p_phone), ''),
    email = nullif(trim(p_email), ''),
    birth_date = p_birth_date,
    sex = nullif(trim(p_sex), ''),
    cpf = CASE
      WHEN p_cpf IS NOT NULL AND trim(regexp_replace(p_cpf, '[^0-9]', '', 'g')) ~ '^\d{11}$'
      THEN trim(regexp_replace(p_cpf, '[^0-9]', '', 'g'))
      ELSE cpf
    END,
    registration_completed_at = now(),
    consent_terms_accepted_at = CASE WHEN p_consent_terms_accepted THEN now() ELSE consent_terms_accepted_at END,
    consent_image_use = CASE WHEN p_consent_terms_accepted THEN COALESCE(p_consent_image_use, false) ELSE consent_image_use END,
    consent_terms_version = CASE WHEN p_consent_terms_accepted THEN nullif(trim(p_consent_terms_version), '') ELSE consent_terms_version END
  WHERE id = v_client_id AND org_id = v_session.org_id;

  INSERT INTO public.audit_logs (
    org_id,
    user_id,
    user_email,
    role_technical,
    job_title,
    action,
    table_name,
    record_id,
    permission_used,
    metadata
  ) VALUES (
    v_session.org_id,
    NULL,
    NULL,
    'client',
    NULL,
    'cliente.completar_cadastro',
    'clients',
    v_client_id,
    NULL,
    jsonb_build_object(
      'completed_by_client', true,
      'client_id', v_client_id,
      'client_name', trim(p_name),
      'client_cpf', CASE WHEN p_cpf IS NOT NULL AND trim(regexp_replace(p_cpf, '[^0-9]', '', 'g')) ~ '^\d{11}$' THEN trim(regexp_replace(p_cpf, '[^0-9]', '', 'g')) ELSE NULL END,
      'consent_terms_accepted', p_consent_terms_accepted,
      'consent_image_use', COALESCE(p_consent_image_use, false)
    )
  );

  RETURN v_client_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.get_client_session_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_client_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.client_complete_registration(
  text, text, text, text, date, text, text, text, boolean, boolean, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_session_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_complete_registration(
  text, text, text, text, date, text, text, text, boolean, boolean, text
) TO anon, authenticated;
