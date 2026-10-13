-- Fase 0 leftover: próxima sessão, pacote, combinado, anamnese.
-- Cole no SQL Editor e Run. Idempotente.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_packages'
  ) THEN
    ALTER TABLE public.client_packages ADD COLUMN IF NOT EXISTS orcamento_id uuid;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.package_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL,
  agenda_id uuid NULL,
  consumed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.package_consumptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org package_consumptions" ON public.package_consumptions;
CREATE POLICY "org package_consumptions" ON public.package_consumptions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_packages p
      WHERE p.id = package_id
        AND p.org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.client_packages p
      WHERE p.id = package_id
        AND p.org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_events'
  ) THEN
    ALTER TABLE public.client_events ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'anamnesis_registros'
  ) THEN
    ALTER TABLE public.anamnesis_registros ADD COLUMN IF NOT EXISTS agenda_id uuid;
    ALTER TABLE public.anamnesis_registros ADD COLUMN IF NOT EXISTS resultado_resumo text;
  END IF;
END $$;
