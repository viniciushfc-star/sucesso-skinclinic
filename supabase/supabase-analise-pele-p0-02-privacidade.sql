-- ============================================================
-- P0-02 — Privacidade das fotos de análise de pele + RPC do portal
--
-- NÃO apaga tabelas, análises, clientes ou organizações.
-- NÃO executa sozinho: rode no SQL Editor do Supabase.
--
-- O que faz:
-- 1) Bucket analise-pele-fotos fica PRIVATE (public = false).
-- 2) Remove políticas de storage específicas desse bucket (não mexe em outros).
-- 3) Substitui get_analises_pele_by_token: sem SELECT *, sem ia_preliminar,
--    texto_validado só se status for validated/incorporated.
--
-- Opcional no final (comentado): converter URLs públicas antigas em paths.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('analise-pele-fotos', 'analise-pele-fotos', false)
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
        COALESCE(qual::text, '') ILIKE '%analise-pele-fotos%'
        OR COALESCE(with_check::text, '') ILIKE '%analise-pele-fotos%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

COMMENT ON COLUMN public.analise_pele.imagens IS 'Array JSON de paths no bucket privado analise-pele-fotos (org_id/client_id/...), nunca URL pública permanente.';
COMMENT ON COLUMN public.analise_pele.ia_preliminar IS 'Texto interno da IA. Nunca expor ao portal do cliente. Só dashboard autorizado.';

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
    RAISE EXCEPTION 'Sessão inválida ou expirada';
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

COMMENT ON FUNCTION public.get_analises_pele_by_token(text) IS 'Portal: lista análises do cliente da sessão. Sem ia_preliminar, sem imagens, texto_validado só após validação.';

GRANT EXECUTE ON FUNCTION public.get_analises_pele_by_token(text) TO anon, authenticated;

-- ------------------------------------------------------------
-- OPCIONAL — só depois de auditar no Table Editor se existem URLs públicas.
-- Não rode cegamente. Não apaga linhas; só reescreve o JSON imagens.
--
-- SELECT id, imagens FROM public.analise_pele
-- WHERE imagens::text ILIKE '%/object/public/analise-pele-fotos/%';
--
-- UPDATE public.analise_pele
-- SET imagens = (
--   SELECT COALESCE(jsonb_agg(to_jsonb(
--     regexp_replace(elem #>> '{}', '^.*analise-pele-fotos/', '')
--   )), '[]'::jsonb)
--   FROM jsonb_array_elements(imagens) AS elem
-- )
-- WHERE imagens::text ILIKE '%analise-pele-fotos%';
-- ------------------------------------------------------------
