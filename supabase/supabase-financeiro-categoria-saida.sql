-- ============================================================
-- FINANCEIRO: categoria da saída (funcionário, insumos, custo fixo, outro)
-- Para mostrar % por tipo de saída e gráfico de pizza.
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

DO $migrate$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financeiro') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financeiro' AND column_name = 'categoria_saida'
    ) THEN
      ALTER TABLE public.financeiro ADD COLUMN categoria_saida text
        CHECK (categoria_saida IS NULL OR categoria_saida IN ('funcionario', 'insumos', 'custo_fixo', 'outro'));
    END IF;
  END IF;
END $migrate$;
