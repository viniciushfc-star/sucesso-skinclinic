-- ============================================================
-- PROCEDIMENTOS COMPLETOS: descrição, valor, vínculo estoque
-- Alinha com PROCEDIMENTOS-IDEA.md (precificação, estoque, finanças).
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

-- 1) Evolução da tabela procedures (descrição, valor cobrado)
DO $migrate$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'procedures' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.procedures ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'procedures' AND column_name = 'valor_cobrado'
  ) THEN
    ALTER TABLE public.procedures ADD COLUMN valor_cobrado decimal(12,2);
  END IF;
END $migrate$;

COMMENT ON COLUMN public.procedures.description IS 'Descricao do servico; usada em precificacao e metricas.';
COMMENT ON COLUMN public.procedures.valor_cobrado IS 'Valor final cobrado; usado em metricas e financas (receita por procedimento).';

-- 2) Vínculo procedimento ↔ estoque (itens normalmente usados + quantidade média)
CREATE TABLE IF NOT EXISTS public.procedure_stock_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_ref text NOT NULL,
  quantity_used decimal(12,4) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(procedure_id, item_ref)
);

CREATE INDEX IF NOT EXISTS idx_procedure_stock_usage_procedure ON public.procedure_stock_usage(procedure_id);
CREATE INDEX IF NOT EXISTS idx_procedure_stock_usage_org ON public.procedure_stock_usage(org_id);

COMMENT ON TABLE public.procedure_stock_usage IS 'Itens de estoque normalmente usados por procedimento; quantidade media; referencia para baixa estimada e conferencia.';
COMMENT ON COLUMN public.procedure_stock_usage.item_ref IS 'Referencia ao item (id ou nome conforme integracao estoque).';

ALTER TABLE public.procedure_stock_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members procedure stock usage" ON public.procedure_stock_usage;
CREATE POLICY "org members procedure stock usage" ON public.procedure_stock_usage
  FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
