-- ============================================================
-- Termo de consentimento do cliente (prestador de serviços + uso de imagem)
-- Proteção jurídica da clínica; cliente assina no portal ou a clínica registra em papel.
-- Execute após: supabase-client-registration-portal.sql (pois substitui a função client_complete_registration).
-- ============================================================

-- Colunas em clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS consent_terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_image_use boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_terms_version text;

COMMENT ON COLUMN public.clients.consent_terms_accepted_at IS 'Data/hora em que o cliente aceitou o termo de consentimento (portal ou registrado pela clínica).';
COMMENT ON COLUMN public.clients.consent_image_use IS 'Cliente autorizou uso de imagens (fotos de procedimento, antes/depois) para acompanhamento e, se aplicável, divulgação institucional com anuência prévia.';
COMMENT ON COLUMN public.clients.consent_terms_version IS 'Versão ou identificador do termo aceito (ex.: v1, 2025-01).';

-- Atualiza a RPC do portal para gravar o consentimento
-- Execute após supabase-client-registration-portal.sql (que cria client_complete_registration)
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
  IF NOT (COALESCE(p_consent_terms_accepted, false)) THEN
    RAISE EXCEPTION 'E obrigatorio aceitar o Termo de Consentimento para continuar';
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
    cpf = CASE
      WHEN p_cpf IS NOT NULL AND trim(regexp_replace(p_cpf, '[^0-9]', '', 'g')) ~ '^\d{11}$'
      THEN trim(regexp_replace(p_cpf, '[^0-9]', '', 'g'))
      ELSE cpf
    END,
    registration_completed_at = now(),
    updated_at = now(),
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
