-- Elo orçamento → pacote (sem duplicar).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_packages' AND column_name = 'orcamento_id'
  ) THEN
    ALTER TABLE public.client_packages ADD COLUMN orcamento_id uuid;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_packages_orcamento
  ON public.client_packages (orcamento_id)
  WHERE orcamento_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_package_consumptions_agenda_unica'
  ) THEN
    CREATE UNIQUE INDEX idx_package_consumptions_agenda_unica
      ON public.package_consumptions (package_id, agenda_id)
      WHERE agenda_id IS NOT NULL;
  END IF;
END $$;
