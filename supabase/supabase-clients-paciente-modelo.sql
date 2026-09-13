-- ============================================================
-- CLIENTES: paciente modelo (valor estratégico; desconto ao agendar)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'is_paciente_modelo'
  ) THEN
    ALTER TABLE public.clients
      ADD COLUMN is_paciente_modelo boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'model_discount_pct'
  ) THEN
    ALTER TABLE public.clients
      ADD COLUMN model_discount_pct numeric(5,2) DEFAULT null
        CHECK (model_discount_pct IS NULL OR (model_discount_pct >= 0 AND model_discount_pct <= 100));
  END IF;
END $$;

COMMENT ON COLUMN public.clients.is_paciente_modelo IS 'Paciente modelo (ex.: modelo de botox); ao agendar pode aplicar desconto.';
COMMENT ON COLUMN public.clients.model_discount_pct IS 'Desconto padrão em % para este paciente modelo (ex.: 30).';
