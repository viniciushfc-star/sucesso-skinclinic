-- ============================================================
-- PROCEDIMENTOS MELHORIAS (curto prazo)
-- Código/sigla, categoria, custo estimado, margem mínima.
-- Alinha com PROCEDIMENTOS-MELHORIAS-IDEA.md.
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

-- 1) Tabela de categorias de procedimento
CREATE TABLE IF NOT EXISTS public.procedure_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_procedure_categories_org ON public.procedure_categories(org_id);
COMMENT ON TABLE public.procedure_categories IS 'Categorias de procedimento por org (Limpeza, Preenchimento, Laser, etc.).';

ALTER TABLE public.procedure_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org members procedure categories" ON public.procedure_categories;
CREATE POLICY "org members procedure categories" ON public.procedure_categories
  FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- 2) Novas colunas em procedures
DO $migrate$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'procedures' AND column_name = 'codigo'
  ) THEN
    ALTER TABLE public.procedures ADD COLUMN codigo text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'procedures' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE public.procedures ADD COLUMN category_id uuid REFERENCES public.procedure_categories(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'procedures' AND column_name = 'custo_material_estimado'
  ) THEN
    ALTER TABLE public.procedures ADD COLUMN custo_material_estimado decimal(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'procedures' AND column_name = 'margem_minima_desejada'
  ) THEN
    ALTER TABLE public.procedures ADD COLUMN margem_minima_desejada decimal(5,2);
  END IF;
END $migrate$;

CREATE INDEX IF NOT EXISTS idx_procedures_category ON public.procedures(category_id);
COMMENT ON COLUMN public.procedures.codigo IS 'Codigo ou sigla do procedimento (ex: LP-01).';
COMMENT ON COLUMN public.procedures.category_id IS 'Categoria do procedimento para filtros e relatorios.';
COMMENT ON COLUMN public.procedures.custo_material_estimado IS 'Custo estimado de material por procedimento; entrada para precificacao.';
COMMENT ON COLUMN public.procedures.margem_minima_desejada IS 'Margem minima desejada (%). Base para sugestao de precificacao.';
