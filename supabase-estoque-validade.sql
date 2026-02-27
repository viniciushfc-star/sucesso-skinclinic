-- ============================================================
-- ESTOQUE — data de validade para alertas "próximo a vencer"
-- Execute no Supabase: SQL Editor → New query → Cole e Run
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estoque_entradas' AND column_name = 'data_validade'
  ) THEN
    ALTER TABLE public.estoque_entradas ADD COLUMN data_validade date;
  END IF;
END $$;

COMMENT ON COLUMN public.estoque_entradas.data_validade IS 'Data de validade do lote (opcional). Usado para alertas de produtos próximos a vencer e campanhas.';
