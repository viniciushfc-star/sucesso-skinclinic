-- ============================================================
-- FINANCEIRO: forma de pagamento e valor recebido (líquido)
-- Para entradas: registrar como a pessoa pagou e quanto entrou de fato,
-- assim ao dar baixa o total de entradas reflete o valor real (evita erro).
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financeiro') THEN

    -- Forma de pagamento (PIX, cartão, dinheiro, etc.)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financeiro' AND column_name = 'forma_pagamento'
    ) THEN
      ALTER TABLE public.financeiro ADD COLUMN forma_pagamento text;
    END IF;

    -- Valor que entrou de fato (líquido). Quando preenchido, usar nos totais de entrada em vez de valor.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financeiro' AND column_name = 'valor_recebido'
    ) THEN
      ALTER TABLE public.financeiro ADD COLUMN valor_recebido numeric CHECK (valor_recebido IS NULL OR valor_recebido >= 0);
    END IF;

  END IF;
END $$;

COMMENT ON COLUMN public.financeiro.forma_pagamento IS 'Como a pessoa pagou (ex.: PIX, cartão crédito, dinheiro). Usado em entradas para dar baixa correta.';
COMMENT ON COLUMN public.financeiro.valor_recebido IS 'Quanto entrou de fato (líquido). Se preenchido, o total de entradas usa este valor; senão usa valor. Evita erro ao dar baixa.';
