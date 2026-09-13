-- Anamnese preenchida pelo cliente no portal (à distância).
-- Rode depois de: supabase-anamnese-canon.sql e supabase-anamnese-ficha-fotos.sql
-- e de get_client_session_by_token existir (portal).

ALTER TABLE public.anamnesis_registros
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'clinica';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'anamnesis_registros_origem_check'
  ) THEN
    ALTER TABLE public.anamnesis_registros
      ADD CONSTRAINT anamnesis_registros_origem_check
      CHECK (origem IN ('clinica', 'portal'));
  END IF;
END $$;

COMMENT ON COLUMN public.anamnesis_registros.origem IS 'clinica = ficha no dashboard; portal = preenchida pelo cliente à distância.';

CREATE OR REPLACE FUNCTION public.submit_anamnese_by_token(
  p_token text,
  p_funcao_slug text,
  p_ficha jsonb,
  p_observacoes text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_org_id uuid;
  v_funcao_id uuid;
  v_id uuid;
  v_slug text;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;

  v_slug := lower(trim(coalesce(p_funcao_slug, 'rosto_pele')));
  IF v_slug NOT IN ('capilar', 'rosto_pele', 'corporal') THEN
    RAISE EXCEPTION 'Área de anamnese inválida';
  END IF;

  IF p_ficha IS NULL OR jsonb_typeof(p_ficha) <> 'object' OR p_ficha = '{}'::jsonb THEN
    RAISE EXCEPTION 'Preencha a ficha antes de enviar';
  END IF;

  SELECT s.client_id, s.org_id INTO v_client_id, v_org_id
  FROM get_client_session_by_token(p_token) AS s
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;

  SELECT id INTO v_funcao_id
  FROM public.anamnesis_funcoes
  WHERE org_id = v_org_id AND slug = v_slug AND active = true
  LIMIT 1;

  IF v_funcao_id IS NULL THEN
    INSERT INTO public.anamnesis_funcoes (org_id, nome, slug, ordem, active)
    VALUES (
      v_org_id,
      CASE v_slug
        WHEN 'capilar' THEN 'Capilar (cabelo)'
        WHEN 'corporal' THEN 'Corporal (corpo)'
        ELSE 'Rosto — Pele'
      END,
      v_slug,
      CASE v_slug WHEN 'capilar' THEN 1 WHEN 'rosto_pele' THEN 2 ELSE 4 END,
      true
    )
    ON CONFLICT (org_id, slug) DO UPDATE SET active = true
    RETURNING id INTO v_funcao_id;
  END IF;

  INSERT INTO public.anamnesis_registros (
    org_id, client_id, funcao_id, conteudo, ficha, fotos, origem
  ) VALUES (
    v_org_id,
    v_client_id,
    v_funcao_id,
    coalesce(trim(p_observacoes), ''),
    p_ficha,
    '[]'::jsonb,
    'portal'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_anamnese_portal_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  origem text,
  funcao_slug text,
  funcao_nome text
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
  FROM get_client_session_by_token(p_token) AS s
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.created_at,
    r.origem,
    f.slug,
    f.nome
  FROM public.anamnesis_registros r
  JOIN public.anamnesis_funcoes f ON f.id = r.funcao_id
  WHERE r.client_id = v_client_id
    AND r.org_id = v_org_id
    AND r.origem = 'portal'
  ORDER BY r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_anamnese_by_token(text, text, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_anamnese_portal_by_token(text) TO anon, authenticated;
