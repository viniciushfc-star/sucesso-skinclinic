-- P1-2: metodologia de rateio de custo fixo na organização.
-- Padrão nao_ratear: o sistema NÃO divide sozinho por número de atendimentos.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS rateio_metodo text DEFAULT 'nao_ratear',
  ADD COLUMN IF NOT EXISTS rateio_horas_mes numeric,
  ADD COLUMN IF NOT EXISTS rateio_capacidade_mes numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_rateio_metodo_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_rateio_metodo_check
      CHECK (rateio_metodo IS NULL OR rateio_metodo IN (
        'nao_ratear', 'hora', 'atendimento', 'sala', 'capacidade'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.organizations.rateio_metodo IS 'Como o custo fixo entra no P&L do procedimento. nao_ratear = só DRE.';
COMMENT ON COLUMN public.organizations.rateio_horas_mes IS 'Horas disponíveis no mês (métodos hora e sala).';
COMMENT ON COLUMN public.organizations.rateio_capacidade_mes IS 'Capacidade teórica de sessões no mês.';
