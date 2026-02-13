-- ============================================================
-- Importação de gastos bancários (Financeiro como consolidador)
-- Transações importadas: flag + origem + conta. Não exige categoria.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financeiro') THEN

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financeiro' AND column_name = 'importado'
    ) THEN
      ALTER TABLE public.financeiro ADD COLUMN importado boolean NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financeiro' AND column_name = 'origem_importacao'
    ) THEN
      ALTER TABLE public.financeiro ADD COLUMN origem_importacao text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financeiro' AND column_name = 'conta_origem'
    ) THEN
      ALTER TABLE public.financeiro ADD COLUMN conta_origem text;
    END IF;

  END IF;
END $$;

COMMENT ON COLUMN public.financeiro.importado IS 'True quando a transação veio de extrato/CSV/OFX; permite cor diferente na lista e revisão.';
COMMENT ON COLUMN public.financeiro.origem_importacao IS 'Ex.: csv, ofx, api. Null para lançamento manual.';
COMMENT ON COLUMN public.financeiro.conta_origem IS 'Conta de origem do banco (ex.: Conta Corrente, Cartão).';
