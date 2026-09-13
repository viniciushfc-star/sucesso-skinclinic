-- ============================================================
-- Termo de consentimento: validação e respaldo (assinatura)
-- Permite: enviar link para o cliente assinar no aparelho dele;
--          ou registrar assinatura presencial (nome por extenso neste aparelho);
--          ou registrar assinatura em papel.
-- Execute após: supabase-client-consent-termo.sql
-- ============================================================

-- Colunas de respaldo em clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS consent_signed_name text,
  ADD COLUMN IF NOT EXISTS consent_signature_method text;

COMMENT ON COLUMN public.clients.consent_signed_name IS 'Nome por extenso usado na assinatura do termo (recurso de validação).';
COMMENT ON COLUMN public.clients.consent_signature_method IS 'Como o termo foi assinado: portal_link (cliente pelo link), presencial_digital (assinatura neste aparelho), papel (assinatura em papel registrada pela clínica).';

-- RPC: cliente assina apenas o termo (link enviado pela clínica — modo ?mode=consent).
-- Exige nome por extenso para respaldo.
CREATE OR REPLACE FUNCTION public.client_sign_consent_only(
  p_token text,
  p_signed_name text,
  p_consent_image_use boolean DEFAULT false,
  p_consent_terms_version text DEFAULT 'v1'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_session RECORD;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RAISE EXCEPTION 'Token invalido';
  END IF;
  IF p_signed_name IS NULL OR length(trim(p_signed_name)) < 3 THEN
    RAISE EXCEPTION 'Informe o nome completo por extenso (como no documento)';
  END IF;

  SELECT s.client_id, s.org_id INTO v_session
  FROM public.client_sessions s
  WHERE s.token = p_token AND s.expires_at > now()
  LIMIT 1;

  IF v_session.client_id IS NULL THEN
    RAISE EXCEPTION 'Link invalido ou expirado. Solicite um novo à clinica.';
  END IF;

  UPDATE public.clients
  SET
    consent_terms_accepted_at = now(),
    consent_image_use = COALESCE(p_consent_image_use, false),
    consent_terms_version = nullif(trim(p_consent_terms_version), ''),
    consent_signed_name = trim(p_signed_name),
    consent_signature_method = 'portal_link',
    updated_at = now()
  WHERE id = v_session.client_id AND org_id = v_session.org_id;

  INSERT INTO public.audit_logs (
    org_id, user_id, user_email, role_technical, action, table_name, record_id, metadata
  ) VALUES (
    v_session.org_id,
    NULL,
    NULL,
    'client',
    'cliente.assinou_termo_link',
    'clients',
    v_session.client_id,
    jsonb_build_object(
      'client_id', v_session.client_id,
      'signed_name', trim(p_signed_name),
      'consent_image_use', COALESCE(p_consent_image_use, false)
    )
  );
END;
$func$;

COMMENT ON FUNCTION public.client_sign_consent_only IS 'Portal: cliente assina apenas o termo de consentimento (link com ?mode=consent). Registra nome por extenso e método portal_link para respaldo.';
