-- P2-6: agenda da jornada no portal (passado + futuro), só horário e procedimento.
-- Sem notas clínicas. Cole no SQL Editor.

CREATE OR REPLACE FUNCTION public.list_portal_jornada_agenda(p_token text)
RETURNS TABLE (
  id uuid,
  data date,
  hora time,
  procedimento text,
  sessao_plano integer,
  sessoes_plano integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
  v_org uuid;
BEGIN
  SELECT s.client_id, s.org_id INTO v_client, v_org
  FROM get_client_session_by_token(p_token) AS s LIMIT 1;
  IF v_client IS NULL OR v_org IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    a.id,
    a.data,
    a.hora,
    a.procedimento,
    a.sessao_plano,
    a.sessoes_plano
  FROM public.agenda a
  WHERE a.org_id = v_org
    AND a.cliente_id = v_client
    AND a.cancelled_at IS NULL
  ORDER BY a.data DESC, a.hora DESC
  LIMIT 30;
END;
$$;

REVOKE ALL ON FUNCTION public.list_portal_jornada_agenda(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_portal_jornada_agenda(text) TO anon, authenticated;

COMMENT ON FUNCTION public.list_portal_jornada_agenda(text) IS 'Portal: horários do cliente da sessão. Sem notas clínicas.';
