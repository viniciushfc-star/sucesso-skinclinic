-- Orçamentos. Cole no SQL Editor e Run.

CREATE TABLE IF NOT EXISTS public.orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'rascunho',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  valid_until date,
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orcamentos_status_chk CHECK (status IN ('rascunho', 'enviado', 'aceito', 'recusado'))
);

CREATE INDEX IF NOT EXISTS idx_orcamentos_org_client ON public.orcamentos (org_id, client_id, created_at DESC);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members orcamentos" ON public.orcamentos;
CREATE POLICY "org members orcamentos"
  ON public.orcamentos
  FOR ALL
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
