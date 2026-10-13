-- Fase 0 leftover: editar cliente e produto.
-- Cole no SQL Editor e Run. Idempotente.
-- Colunas que a UI já envia; UPDATE de clients com WITH CHECK explícito.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_paciente_modelo boolean NOT NULL DEFAULT false;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS model_discount_pct numeric(5,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clients_model_discount_pct_check'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_model_discount_pct_check
      CHECK (model_discount_pct IS NULL OR (model_discount_pct >= 0 AND model_discount_pct <= 100));
  END IF;
END $$;

DROP POLICY IF EXISTS "Org members can update clients" ON public.clients;
CREATE POLICY "Org members can update clients"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid())
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'estoque_produtos'
  ) THEN
    ALTER TABLE public.estoque_produtos ADD COLUMN IF NOT EXISTS quantidade_minima decimal(12,4);
    ALTER TABLE public.estoque_produtos ADD COLUMN IF NOT EXISTS imagem_url text;
    ALTER TABLE public.estoque_produtos ADD COLUMN IF NOT EXISTS observacao text;
    ALTER TABLE public.estoque_produtos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
  END IF;
END $$;
