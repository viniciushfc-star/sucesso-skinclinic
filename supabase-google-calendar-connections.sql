-- Conexões Google Calendar por profissional (para sync com external_calendar_blocks).
-- O refresh_token é usado apenas no backend (API); o frontend nunca o lê.

CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_google_calendar_connections_org
  ON public.google_calendar_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_google_calendar_connections_user
  ON public.google_calendar_connections(user_id);

COMMENT ON TABLE public.google_calendar_connections IS 'OAuth Google Calendar: refresh_token usado pela API para sincronizar eventos em external_calendar_blocks. Frontend não deve ler refresh_token.';

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members google calendar connections" ON public.google_calendar_connections;
CREATE POLICY "org members google calendar connections" ON public.google_calendar_connections
  FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
