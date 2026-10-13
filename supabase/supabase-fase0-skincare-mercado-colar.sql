-- Destaques de skincare com fonte. Cole no SQL Editor e Run. Idempotente.
-- Sem fonte completa o app não mostra nem manda para a IA.
-- Não inventa ranking. Não muda rotina sozinho.

CREATE TABLE IF NOT EXISTS public.skincare_mercado_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  marca_produto text NOT NULL,
  porque text NOT NULL,
  fonte text NOT NULL,
  data_ref date NOT NULL,
  metodologia text NOT NULL,
  confianca text NOT NULL CHECK (confianca IN ('baixa', 'media', 'alta')),
  amostra integer NOT NULL CHECK (amostra >= 1),
  regiao text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_skincare_mercado_org
  ON public.skincare_mercado_refs (org_id, data_ref DESC);

ALTER TABLE public.skincare_mercado_refs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org skincare_mercado_refs" ON public.skincare_mercado_refs;
CREATE POLICY "org skincare_mercado_refs"
  ON public.skincare_mercado_refs
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

COMMENT ON TABLE public.skincare_mercado_refs IS
  'Destaque de mercado citado pela clínica (lançamento, consenso, pesquisa). Sem fonte o frontend não lista.';
