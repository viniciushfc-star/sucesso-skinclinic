-- P2-9 Market Radar: referências observadas com fonte. Sem fonte o app não compara.
-- Não inventa concorrente. Cole no SQL Editor.

CREATE TABLE IF NOT EXISTS public.market_radar_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  procedimento text NOT NULL,
  procedure_id uuid,
  regiao text NOT NULL,
  preco_min numeric(12,2) NOT NULL,
  preco_max numeric(12,2) NOT NULL,
  fonte text NOT NULL,
  data_ref date NOT NULL,
  metodologia text NOT NULL,
  confianca text NOT NULL CHECK (confianca IN ('baixa', 'media', 'alta')),
  amostra integer NOT NULL CHECK (amostra >= 1),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_market_radar_org ON public.market_radar_refs(org_id, data_ref DESC);

COMMENT ON TABLE public.market_radar_refs IS 'Referência de mercado observada pela clínica. Sem fonte completa o frontend não renderiza o número.';

ALTER TABLE public.market_radar_refs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members market_radar_refs" ON public.market_radar_refs;
CREATE POLICY "org members market_radar_refs"
  ON public.market_radar_refs
  FOR ALL
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
