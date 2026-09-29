ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS relacao_comercial text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_relacao_comercial_chk'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_relacao_comercial_chk
      CHECK (relacao_comercial IS NULL OR relacao_comercial IN ('orcamento', 'comprou', 'revenda'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_org_relacao
  ON public.clients (org_id, relacao_comercial);
