-- P1: portal RPC sem SETOF, sessão com last_used/revoked, calendário só dono, uso de IA persistido.
-- Não apaga dados. Rode no SQL Editor após supabase-p0-rls-isolamento.sql.

ALTER TABLE public.client_sessions ADD COLUMN IF NOT EXISTS last_used_at timestamptz;
ALTER TABLE public.client_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

COMMENT ON COLUMN public.client_sessions.last_used_at IS 'Último uso do link do portal (trilha técnica de acesso).';
COMMENT ON COLUMN public.client_sessions.revoked_at IS 'Se preenchido, o token não autentica mais.';

DROP FUNCTION IF EXISTS public.get_client_session_by_token(text);
DROP FUNCTION IF EXISTS public.get_client_by_token(text);

CREATE OR REPLACE FUNCTION public.get_client_session_by_token(p_token text)
RETURNS TABLE (client_id uuid, org_id uuid, expires_at timestamptz, registration_completed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN;
  END IF;

  UPDATE public.client_sessions
  SET last_used_at = now()
  WHERE token = p_token
    AND expires_at > now()
    AND revoked_at IS NULL;

  RETURN QUERY
  SELECT
    s.client_id,
    s.org_id,
    s.expires_at,
    c.registration_completed_at
  FROM public.client_sessions s
  JOIN public.clients c ON c.id = s.client_id AND c.org_id = s.org_id
  WHERE s.token = p_token
    AND s.expires_at > now()
    AND s.revoked_at IS NULL
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
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN;
  END IF;
  SELECT s.client_id, s.org_id INTO v_session
  FROM public.client_sessions s
  WHERE s.token = p_token
    AND s.expires_at > now()
    AND s.revoked_at IS NULL
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

DROP POLICY IF EXISTS "org members google calendar connections" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "owner google calendar connections" ON public.google_calendar_connections;
CREATE POLICY "owner google calendar connections"
  ON public.google_calendar_connections
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  feature text NOT NULL,
  model text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created
  ON public.ai_usage_events (user_id, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ai_usage_events IS 'Custo de IA por usuário/org. Escrita via service role. Sem policy de INSERT para authenticated.';

COMMENT ON TABLE public.client_sessions IS 'Sessão do portal. Token em claro nesta fase (hash = P1 restante). last_used_at/revoked_at para trilha e revogação.';
