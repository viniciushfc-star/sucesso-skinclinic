-- Sessão do portal: expires_at do RETURNS TABLE colidia com a coluna da tabela.
-- Cole no SQL Editor. Não apaga dados.

CREATE OR REPLACE FUNCTION public.get_client_session_by_token(p_token text)
RETURNS TABLE (client_id uuid, org_id uuid, expires_at timestamptz, registration_completed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
#variable_conflict use_column
DECLARE
  v_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN;
  END IF;

  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'::text), 'hex');

  UPDATE public.client_sessions s
  SET last_used_at = now()
  WHERE s.revoked_at IS NULL
    AND s.expires_at > now()
    AND (s.token_hash = v_hash OR (s.token_hash IS NULL AND s.token = p_token));

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

REVOKE ALL ON FUNCTION public.get_client_session_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_session_by_token(text) TO anon, authenticated;
