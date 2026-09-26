-- Lotes / perdas / mínimo: colunas opcionais. Sem DROP. Sem tabela paralela.
-- Cole no SQL Editor e Run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estoque_produtos' AND column_name = 'quantidade_minima'
  ) THEN
    ALTER TABLE public.estoque_produtos ADD COLUMN quantidade_minima decimal(12,4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estoque_consumo' AND column_name = 'lote'
  ) THEN
    ALTER TABLE public.estoque_consumo ADD COLUMN lote text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estoque_consumo' AND column_name = 'motivo'
  ) THEN
    ALTER TABLE public.estoque_consumo ADD COLUMN motivo text;
  END IF;
END $$;

COMMENT ON COLUMN public.estoque_produtos.quantidade_minima IS 'Piso de alerta. Não trava atendimento.';
COMMENT ON COLUMN public.estoque_consumo.lote IS 'Lote da perda ou conferência, se informado.';
COMMENT ON COLUMN public.estoque_consumo.motivo IS 'perda | inventario | texto curto.';
