-- Anamnese: campo opcional de resumo de resultado (antes/depois)
-- Uso: salvar um texto curto e editável descrevendo o que foi conquistado no período.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'anamnesis_registros'
      AND column_name = 'resultado_resumo'
  ) THEN
    ALTER TABLE public.anamnesis_registros
      ADD COLUMN resultado_resumo text;

    COMMENT ON COLUMN public.anamnesis_registros.resultado_resumo IS
      'Resumo textual opcional do resultado (antes/depois), usado em laudos, propostas ou materiais para o cliente.';
  END IF;
END $$;

