-- Lote 8: mapeamento agenda clínica → evento genérico no Google (sem PII).

CREATE TABLE IF NOT EXISTS public.agenda_google_events (
  agenda_id uuid PRIMARY KEY REFERENCES public.agenda(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  google_event_id text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_google_events_org_user
  ON public.agenda_google_events (org_id, user_id);

ALTER TABLE public.agenda_google_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members read agenda_google_events" ON public.agenda_google_events;
CREATE POLICY "org members read agenda_google_events"
  ON public.agenda_google_events FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );

COMMENT ON TABLE public.agenda_google_events IS 'Ligação agenda da clínica ↔ evento genérico no Google. Sem nome de paciente.';
