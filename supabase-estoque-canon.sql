-- ============================================================
-- ESTOQUE CANÔNICO — entrada facilitada, histórico de custo, consumo estimado
-- Alinha com estoque-ocr-canon: referência inteligente, não verdade absoluta.
-- ============================================================

-- 1) Entradas de estoque (por OCR, manual ou XML)
CREATE TABLE IF NOT EXISTS public.estoque_entradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  produto_nome text NOT NULL,
  quantidade decimal(12,4) NOT NULL DEFAULT 1,
  valor_unitario decimal(12,4),
  valor_total decimal(12,4),
  fornecedor text,
  data_entrada date NOT NULL DEFAULT (current_date),
  lote text,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('ocr', 'manual', 'xml')),
  ocr_nota_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_estoque_entradas_org ON public.estoque_entradas(org_id);
CREATE INDEX IF NOT EXISTS idx_estoque_entradas_produto ON public.estoque_entradas(org_id, produto_nome);
CREATE INDEX IF NOT EXISTS idx_estoque_entradas_data ON public.estoque_entradas(org_id, data_entrada);

COMMENT ON TABLE public.estoque_entradas IS 'Entradas de estoque: OCR, manual ou XML. Histórico de custo; não bloqueia uso.';
COMMENT ON COLUMN public.estoque_entradas.origem IS 'ocr | manual | xml';
COMMENT ON COLUMN public.estoque_entradas.ocr_nota_id IS 'Referência à nota lida por OCR (ocr_notas.id) se origem = ocr.';

-- 2) Consumo estimado (baixa quando procedimento ocorre)
CREATE TABLE IF NOT EXISTS public.estoque_consumo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  produto_nome text NOT NULL,
  quantidade decimal(12,4) NOT NULL DEFAULT 0,
  procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL,
  agenda_id uuid,
  tipo text NOT NULL DEFAULT 'estimado' CHECK (tipo IN ('estimado', 'ajuste')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_estoque_consumo_org ON public.estoque_consumo(org_id);
CREATE INDEX IF NOT EXISTS idx_estoque_consumo_produto ON public.estoque_consumo(org_id, produto_nome);

COMMENT ON TABLE public.estoque_consumo IS 'Baixa estimada (procedimento) ou ajuste manual. Divergência é informação, não punição.';

-- 3) RLS
ALTER TABLE public.estoque_entradas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org members estoque entradas" ON public.estoque_entradas;
CREATE POLICY "org members estoque entradas" ON public.estoque_entradas
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

ALTER TABLE public.estoque_consumo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org members estoque consumo" ON public.estoque_consumo;
CREATE POLICY "org members estoque consumo" ON public.estoque_consumo
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
