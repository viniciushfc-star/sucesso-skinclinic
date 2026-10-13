-- Fase 0 leftover: Dar baixa + custo/margem do procedimento.
-- Cole no SQL Editor e Run. Idempotente.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'financeiro'
  ) THEN
    ALTER TABLE public.financeiro ADD COLUMN IF NOT EXISTS agenda_id uuid;
    ALTER TABLE public.financeiro ADD COLUMN IF NOT EXISTS procedure_id uuid;
    ALTER TABLE public.financeiro ADD COLUMN IF NOT EXISTS forma_pagamento text;
    ALTER TABLE public.financeiro ADD COLUMN IF NOT EXISTS valor_recebido numeric;
    ALTER TABLE public.financeiro ADD COLUMN IF NOT EXISTS categoria_saida text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'procedures'
  ) THEN
    ALTER TABLE public.procedures ADD COLUMN IF NOT EXISTS custo_material_estimado decimal(12,2);
    ALTER TABLE public.procedures ADD COLUMN IF NOT EXISTS margem_minima_desejada decimal(5,2);
    ALTER TABLE public.procedures ADD COLUMN IF NOT EXISTS comissao_profissional_pct numeric(5,2);
  END IF;
END $$;
