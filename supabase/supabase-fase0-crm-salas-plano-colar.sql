-- Fase 0 leftover: CRM (cancelled_at), salas, plano, skincare.
-- Cole no SQL Editor e Run. Idempotente.

ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'salas'
  ) THEN
    ALTER TABLE public.salas ADD COLUMN IF NOT EXISTS ativa boolean DEFAULT true;
    ALTER TABLE public.salas ADD COLUMN IF NOT EXISTS procedimento_tipos jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.skincare_rotinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  client_id uuid NOT NULL,
  conteudo text NOT NULL DEFAULT '',
  liberado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'planos_terapeuticos'
  ) THEN
    ALTER TABLE public.planos_terapeuticos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
  END IF;
END $$;
