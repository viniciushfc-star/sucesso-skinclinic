-- P2 lote 2: portal não devolve notes da clínica; audit_logs sem INSERT autenticado.
-- CPF permanece no RPC de cadastro (dado do próprio titular no formulário).
-- Replay: DROP FUNCTION exigido porque RETURNS TABLE muda.

DROP FUNCTION IF EXISTS public.get_client_by_token(text);

CREATE FUNCTION public.get_client_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  name text,
  phone text,
  email text,
  cpf text,
  birth_date date,
  sex text,
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
    c.registration_completed_at
  FROM public.clients c
  WHERE c.id = v_session.client_id AND c.org_id = v_session.org_id
  LIMIT 1;
END;
$func$;

REVOKE ALL ON FUNCTION public.get_client_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_by_token(text) TO anon, authenticated;

DROP POLICY IF EXISTS "audit_logs_insert_org" ON public.audit_logs;

REVOKE INSERT ON TABLE public.audit_logs FROM PUBLIC;
REVOKE INSERT ON TABLE public.audit_logs FROM anon;
REVOKE INSERT ON TABLE public.audit_logs FROM authenticated;
