-- Quem vendeu (análise) ≠ quem aplica no horário.
-- Cole no SQL Editor e Run. Idempotente. Não paga e não muda preço.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agenda'
  ) THEN
    ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS sold_by_user_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orcamentos'
  ) THEN
    ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS sold_by_user_id uuid;
  END IF;
END $$;
