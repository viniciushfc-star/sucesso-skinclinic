-- ============================================================
-- Cadastro enviado ao cliente: portal para completar cadastro
-- Um único cadastro por cliente; auditoria registra "cliente X completou o próprio cadastro"
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

-- 1) Coluna: cadastro completado pelo cliente (null = pendente)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS registration_completed_at timestamptz;

COMMENT ON COLUMN public.clients.registration_completed_at IS 'Preenchido quando o cliente completa o cadastro pelo portal (self-registration)';

-- 2) RPC: obter sessão do cliente pelo token (portal usa sem login staff)
-- Permite ao portal validar o token e saber client_id, org_id, se já completou
CREATE OR REPLACE FUNCTION public.get_client_session_by_token(p_token text)
RETURNS TABLE (client_id uuid, org_id uuid, expires_at timestamptz, registration_completed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    s.client_id,
    s.org_id,
    s.expires_at,
    c.registration_completed_at
  FROM public.client_sessions s
  JOIN public.clients c ON c.id = s.client_id AND c.org_id = s.org_id
  WHERE s.token = p_token AND s.expires_at > now()
  LIMIT 1;
END;
$func$;

-- 3) RPC: staff cria sessão (link) para o cliente acessar o portal
-- Um único link ativo por cliente: invalida sessões anteriores
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
    SELECT 1 FROM organization_users
    WHERE org_id = p_org_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Sem permissao nesta organizacao';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM clients
    WHERE id = p_client_id AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Cliente nao encontrado';
  END IF;

  UPDATE public.client_sessions
  SET expires_at = now()
  WHERE org_id = p_org_id AND client_id = p_client_id;

  v_token := gen_random_uuid()::text || '-' || encode(gen_random_bytes(12), 'hex');

  INSERT INTO public.client_sessions (org_id, client_id, token, expires_at)
  VALUES (p_org_id, p_client_id, v_token, now() + interval '30 days');

  RETURN v_token;
END;
$func$;

-- 4) RPC: portal lê dados do cliente (para preencher formulário)
CREATE OR REPLACE FUNCTION public.get_client_by_token(p_token text)
RETURNS SETOF public.clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_session RECORD;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN;
  END IF;
  SELECT s.client_id, s.org_id INTO v_session
  FROM public.client_sessions s
  WHERE s.token = p_token AND s.expires_at > now()
  LIMIT 1;
  IF v_session.client_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT c.*
  FROM public.clients c
  WHERE c.id = v_session.client_id AND c.org_id = v_session.org_id
  LIMIT 1;
END;
$func$;

-- 5) RPC: cliente completa o próprio cadastro (portal)
-- Atualiza client e insere auditoria com "cliente X completou o próprio cadastro"
CREATE OR REPLACE FUNCTION public.client_complete_registration(
  p_token text,
  p_name text,
  p_phone text,
  p_email text,
  p_birth_date date DEFAULT NULL,
  p_sex text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_session RECORD;
  v_client_id uuid;
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

  SELECT s.client_id, s.org_id INTO v_session
  FROM public.client_sessions s
  WHERE s.token = p_token AND s.expires_at > now()
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
    notes = nullif(trim(p_notes), ''),
    registration_completed_at = now(),
    updated_at = now()
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
      'client_name', trim(p_name)
    )
  );

  RETURN v_client_id;
END;
$func$;

-- Se o INSERT em audit_logs falhar com "null value in column user_id":
-- ALTER TABLE public.audit_logs ALTER COLUMN user_id DROP NOT NULL;
-- ALTER TABLE public.audit_logs ALTER COLUMN user_email DROP NOT NULL;

