-- Taxa de transação e à vista separado débito/crédito.
-- Mantém parcelado 2-6 e 7-12. Rode após supabase-organization-taxas.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'taxa_transacao_pct') THEN
    ALTER TABLE public.organizations ADD COLUMN taxa_transacao_pct numeric(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'taxa_avista_debito_pct') THEN
    ALTER TABLE public.organizations ADD COLUMN taxa_avista_debito_pct numeric(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'taxa_avista_credito_pct') THEN
    ALTER TABLE public.organizations ADD COLUMN taxa_avista_credito_pct numeric(5,2);
  END IF;
END $$;

COMMENT ON COLUMN public.organizations.taxa_transacao_pct IS 'Taxa de transação (%), aplicada além da taxa por forma de pagamento.';
COMMENT ON COLUMN public.organizations.taxa_avista_debito_pct IS 'Taxa à vista no débito (%).';
COMMENT ON COLUMN public.organizations.taxa_avista_credito_pct IS 'Taxa à vista no crédito (%).';
