-- CRM operacional: lista de espera + link do Google + meta de fidelidade.
-- Rode no SQL Editor do Supabase (org autenticada).

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS google_review_url text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS fidelidade_visitas integer DEFAULT 10;

CREATE TABLE IF NOT EXISTS public.agenda_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NULL,
  nome text NOT NULL,
  phone text NULL,
  procedure_name text NULL,
  preferred_date date NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'aberta',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_waitlist_org_status ON public.agenda_waitlist(org_id, status);

ALTER TABLE public.agenda_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org agenda_waitlist" ON public.agenda_waitlist;
CREATE POLICY "org agenda_waitlist" ON public.agenda_waitlist
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
