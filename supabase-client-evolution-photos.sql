-- ============================================================
-- Fotos de evolução do cliente (antes/depois) no prontuário
-- Permite registrar fotos por data e opcionalmente por procedimento.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_evolution_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  taken_at date NOT NULL,
  photo_url text NOT NULL,
  type text NOT NULL DEFAULT 'antes' CHECK (type IN ('antes', 'depois')),
  procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_evolution_photos_client ON public.client_evolution_photos(client_id);
CREATE INDEX IF NOT EXISTS idx_client_evolution_photos_taken ON public.client_evolution_photos(taken_at);

COMMENT ON TABLE public.client_evolution_photos IS 'Fotos de evolução (antes/depois) do cliente para prontuário e comparativo de tratamento.';

ALTER TABLE public.client_evolution_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members client_evolution_photos" ON public.client_evolution_photos;
CREATE POLICY "Org members client_evolution_photos"
  ON public.client_evolution_photos FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
