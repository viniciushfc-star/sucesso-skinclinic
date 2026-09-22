-- P2-4: plano na agenda; RPC do portal (hash); Storage clínico só com prefixo da org.
-- Não apaga dados. Cole no SQL Editor do Supabase.

ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS plano_id uuid;
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS sessao_plano integer;
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS sessoes_plano integer;

COMMENT ON COLUMN public.agenda.plano_id IS 'Plano terapêutico desta sessão, se o horário nasceu de um plano.';
COMMENT ON COLUMN public.agenda.sessao_plano IS 'Número da sessão no plano (1-based).';
COMMENT ON COLUMN public.agenda.sessoes_plano IS 'Total de sessões do plano no momento do agendamento.';

ALTER TABLE public.client_sessions ADD COLUMN IF NOT EXISTS last_used_at timestamptz;
ALTER TABLE public.client_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.client_sessions ADD COLUMN IF NOT EXISTS token_hash text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'planos_terapeuticos'
  ) THEN
    ALTER TABLE public.agenda DROP CONSTRAINT IF EXISTS agenda_plano_id_fkey;
    ALTER TABLE public.agenda
      ADD CONSTRAINT agenda_plano_id_fkey
      FOREIGN KEY (plano_id) REFERENCES public.planos_terapeuticos(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

REVOKE ALL ON FUNCTION public.get_client_session_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_client_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_session_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_by_token(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_analises_pele_by_token(text);

CREATE FUNCTION public.get_analises_pele_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  status text,
  created_at timestamptz,
  texto_validado text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_org_id uuid;
BEGIN
  SELECT s.client_id, s.org_id INTO v_client_id, v_org_id
  FROM get_client_session_by_token(p_token) AS s(client_id uuid, org_id uuid, expires_at timestamptz, registration_completed_at timestamptz)
  LIMIT 1;
  IF v_client_id IS NULL OR v_org_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    a.id,
    a.status,
    a.created_at,
    CASE
      WHEN a.status IN ('validated', 'incorporated') THEN a.texto_validado
      ELSE NULL
    END
  FROM public.analise_pele a
  WHERE a.client_id = v_client_id
    AND a.org_id = v_org_id
  ORDER BY a.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_analises_pele_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_analises_pele_by_token(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_analises_pele_by_token(text) IS 'Portal: só análises do client_id da sessão. Sem ia_preliminar, sem imagens.';

UPDATE storage.buckets
SET public = false
WHERE id IN ('client-photos', 'anamnese-fotos', 'analise-pele-fotos');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('client-photos', 'client-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('anamnese-fotos', 'anamnese-fotos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('analise-pele-fotos', 'analise-pele-fotos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = false;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual::text, '') ILIKE '%client-photos%'
        OR COALESCE(with_check::text, '') ILIKE '%client-photos%'
        OR COALESCE(qual::text, '') ILIKE '%anamnese-fotos%'
        OR COALESCE(with_check::text, '') ILIKE '%anamnese-fotos%'
        OR COALESCE(qual::text, '') ILIKE '%analise-pele-fotos%'
        OR COALESCE(with_check::text, '') ILIKE '%analise-pele-fotos%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "org prefix read client-photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org prefix write client-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-photos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org prefix update client-photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org prefix delete client-photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org prefix read anamnese-fotos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'anamnese-fotos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org prefix write anamnese-fotos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'anamnese-fotos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org prefix update anamnese-fotos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'anamnese-fotos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org prefix delete anamnese-fotos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'anamnese-fotos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org prefix read analise-pele-fotos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'analise-pele-fotos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org prefix write analise-pele-fotos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'analise-pele-fotos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org prefix update analise-pele-fotos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'analise-pele-fotos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org prefix delete analise-pele-fotos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'analise-pele-fotos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM public.organization_users WHERE user_id = auth.uid()
    )
  );
