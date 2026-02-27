-- ============================================================
-- AGENDA: desconto modelo no agendamento (valor aplicado naquele dia)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'is_modelo_agendamento'
  ) THEN
    ALTER TABLE public.agenda
      ADD COLUMN is_modelo_agendamento boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'desconto_modelo_pct'
  ) THEN
    ALTER TABLE public.agenda
      ADD COLUMN desconto_modelo_pct numeric(5,2) DEFAULT null
        CHECK (desconto_modelo_pct IS NULL OR (desconto_modelo_pct >= 0 AND desconto_modelo_pct <= 100));
  END IF;
END $$;

COMMENT ON COLUMN public.agenda.is_modelo_agendamento IS 'Este agendamento teve desconto de paciente modelo aplicado.';
COMMENT ON COLUMN public.agenda.desconto_modelo_pct IS 'Desconto % aplicado neste agendamento (paciente modelo).';
