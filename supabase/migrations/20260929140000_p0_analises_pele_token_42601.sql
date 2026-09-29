-- Live: 42601 (alias) + 42804 (tipos do RETURN QUERY).
-- Colar: supabase/supabase-fix-analises-pele-token.sql

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
SET search_path = public, extensions
AS $func$
#variable_conflict use_column
DECLARE
  v_client_id uuid;
  v_org_id uuid;
BEGIN
  SELECT s.client_id, s.org_id INTO v_client_id, v_org_id
  FROM public.get_client_session_by_token(p_token) AS s
  LIMIT 1;
  IF v_client_id IS NULL OR v_org_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    a.id::uuid,
    a.status::text,
    a.created_at::timestamptz,
    CASE
      WHEN a.status::text IN ('validated', 'incorporated') THEN a.texto_validado
      ELSE NULL
    END::text
  FROM public.analise_pele a
  WHERE a.client_id = v_client_id
    AND a.org_id = v_org_id
  ORDER BY a.created_at DESC;
END;
$func$;

REVOKE ALL ON FUNCTION public.get_analises_pele_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_analises_pele_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_analises_pele_by_token(text) TO service_role;
