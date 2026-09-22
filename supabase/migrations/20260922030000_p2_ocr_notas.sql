-- P2-8: histórico da nota lida por OCR (referência, não verdade fiscal).
-- Não apaga estoque_entradas. Cole no SQL Editor.

CREATE TABLE IF NOT EXISTS public.ocr_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  raw_text text,
  parsed jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_ocr_notas_org ON public.ocr_notas(org_id, created_at DESC);

COMMENT ON TABLE public.ocr_notas IS 'Texto e JSON sugeridos pelo OCR. Humano confere antes de gravar estoque.';

ALTER TABLE public.ocr_notas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members ocr_notas" ON public.ocr_notas;
CREATE POLICY "org members ocr_notas"
  ON public.ocr_notas
  FOR ALL
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
