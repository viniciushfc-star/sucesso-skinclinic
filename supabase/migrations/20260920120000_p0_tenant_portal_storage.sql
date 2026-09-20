-- P0: RLS whatsapp_logs, buckets clínicos privados, token de portal com hash e TTL 7 dias.
-- Não apaga sessões ativas. Tokens antigos (coluna token em claro) continuam válidos até expirar.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'whatsapp_logs'
  ) THEN
    ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "org whatsapp_logs" ON public.whatsapp_logs;
    CREATE POLICY "org whatsapp_logs"
      ON public.whatsapp_logs
      FOR ALL
      TO authenticated
      USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
      WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
  END IF;
END $$;

UPDATE storage.buckets
SET public = false
WHERE id IN ('client-photos', 'anamnese-fotos');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'anamnese-fotos',
  'anamnese-fotos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Org members can read anamnese photos" ON storage.objects;
CREATE POLICY "Org members can read anamnese photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'anamnese-fotos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can upload anamnese photos" ON storage.objects;
CREATE POLICY "Org members can upload anamnese photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'anamnese-fotos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can update anamnese photos" ON storage.objects;
CREATE POLICY "Org members can update anamnese photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'anamnese-fotos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can delete anamnese photos" ON storage.objects;
CREATE POLICY "Org members can delete anamnese photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'anamnese-fotos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.client_sessions ADD COLUMN IF NOT EXISTS last_used_at timestamptz;
ALTER TABLE public.client_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.client_sessions ADD COLUMN IF NOT EXISTS token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_sessions_token_hash
  ON public.client_sessions (token_hash)
  WHERE token_hash IS NOT NULL;

COMMENT ON COLUMN public.client_sessions.token_hash IS 'SHA-256 hex do token. Sessões novas não guardam o valor em claro.';

DROP FUNCTION IF EXISTS public.get_client_session_by_token(text);
DROP FUNCTION IF EXISTS public.get_client_by_token(text);

CREATE OR REPLACE FUNCTION public.get_client_session_by_token(p_token text)
RETURNS TABLE (client_id uuid, org_id uuid, expires_at timestamptz, registration_completed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN;
  END IF;

  v_hash := encode(digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');

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
  notes text,
  registration_completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_session RECORD;
  v_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN;
  END IF;
  v_hash := encode(digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
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
    c.cpf,
    c.birth_date::date,
    c.sex,
    c.notes,
    c.registration_completed_at
  FROM public.clients c
  WHERE c.id = v_session.client_id AND c.org_id = v_session.org_id
  LIMIT 1;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_client_session_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_by_token(text) TO anon, authenticated;
