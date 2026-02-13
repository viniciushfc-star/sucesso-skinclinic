-- ============================================================
-- Portal do Cliente - Script Completo
-- Cria tabela client_sessions e todas as funções RPC necessárias
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

-- 1) Tabela client_sessions (se não existir)
CREATE TABLE IF NOT EXISTS public.client_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_sessions_token ON public.client_sessions(token);
CREATE INDEX IF NOT EXISTS idx_client_sessions_client ON public.client_sessions(org_id, client_id);

ALTER TABLE public.client_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org can manage client_sessions" ON public.client_sessions;
CREATE POLICY "Org can manage client_sessions"
  ON public.client_sessions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE org_id = client_sessions.org_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE org_id = client_sessions.org_id AND user_id = auth.uid()
    )
  );

-- 2) Coluna registration_completed_at em clients (se não existir)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS registration_completed_at timestamptz;

COMMENT ON COLUMN public.clients.registration_completed_at IS 'Preenchido quando o cliente completa o cadastro pelo portal (self-registration)';

-- 3) RPC: obter sessão do cliente pelo token (portal usa sem login staff)
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

-- 4) RPC: staff cria sessão (link) para o cliente acessar o portal
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

  -- Invalida sessões anteriores do mesmo cliente
  UPDATE public.client_sessions
  SET expires_at = now()
  WHERE org_id = p_org_id AND client_id = p_client_id AND expires_at > now();

  -- Gera novo token
  v_token := gen_random_uuid()::text || '-' || encode(gen_random_bytes(12), 'hex');

  -- Insere nova sessão (válida por 30 dias)
  INSERT INTO public.client_sessions (org_id, client_id, token, expires_at)
  VALUES (p_org_id, p_client_id, v_token, now() + interval '30 days')
  ON CONFLICT (token) DO NOTHING;

  RETURN v_token;
END;
$func$;

-- 5) RPC: portal lê dados do cliente (para preencher formulário)
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

-- 6) RPC: cliente completa o próprio cadastro (portal)
-- Remove TODAS as versões antigas da função (com diferentes números de parâmetros)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid::regprocedure::text AS func_name
    FROM pg_proc
    WHERE proname = 'client_complete_registration'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_name || ' CASCADE';
  END LOOP;
END $$;

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
  IF NOT p_consent_terms_accepted THEN
    RAISE EXCEPTION 'E obrigatorio aceitar o Termo de Consentimento';
  END IF;

  SELECT s.client_id, s.org_id INTO v_session
  FROM public.client_sessions s
  WHERE s.token = p_token AND s.expires_at > now()
  LIMIT 1;

  IF v_session.client_id IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida ou expirada';
  END IF;

  v_client_id := v_session.client_id;

  -- Atualiza dados do cliente
  UPDATE public.clients
  SET
    name = trim(p_name),
    phone = nullif(trim(p_phone), ''),
    email = nullif(trim(p_email), ''),
    birth_date = p_birth_date,
    sex = nullif(trim(p_sex), ''),
    notes = nullif(trim(p_notes), ''),
    cpf = nullif(trim(p_cpf), ''),
    registration_completed_at = now(),
    updated_at = now()
  WHERE id = v_client_id AND org_id = v_session.org_id;

  -- Registra auditoria (se a tabela audit_logs existir e permitir user_id NULL)
  BEGIN
    INSERT INTO public.audit_logs (
      org_id,
      user_id,
      user_email,
      role_technical,
      action,
      table_name,
      record_id,
      metadata
    ) VALUES (
      v_session.org_id,
      NULL,
      NULL,
      'client',
      'cliente.completar_cadastro',
      'clients',
      v_client_id,
      jsonb_build_object(
        'completed_by_client', true,
        'client_id', v_client_id,
        'client_name', trim(p_name),
        'consent_terms_accepted', p_consent_terms_accepted,
        'consent_image_use', p_consent_image_use,
        'consent_terms_version', p_consent_terms_version
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Se audit_logs não existir ou não permitir NULL, ignora
    NULL;
  END;

  RETURN v_client_id;
END;
$func$;

-- Se audit_logs não permitir user_id NULL, execute antes:
-- ALTER TABLE public.audit_logs ALTER COLUMN user_id DROP NOT NULL;
-- ALTER TABLE public.audit_logs ALTER COLUMN user_email DROP NOT NULL;

COMMENT ON FUNCTION public.create_client_portal_session IS 'Staff cria link (token) para cliente acessar o portal. Um único link ativo por cliente.';
COMMENT ON FUNCTION public.get_client_session_by_token IS 'Portal valida token e obtém client_id, org_id, se já completou cadastro.';
COMMENT ON FUNCTION public.get_client_by_token IS 'Portal lê dados do cliente para preencher formulário.';
COMMENT ON FUNCTION public.client_complete_registration IS 'Cliente completa próprio cadastro pelo portal. Registra auditoria.';
