-- Taxa por número de parcelas (2x, 3x, ... 12x), cada um com sua própria %.
-- Rode após supabase-organization-taxas-transacao-avista.sql (ou após supabase-organization-taxas.sql).

DO $$
BEGIN
  FOR i IN 2..12 LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'organizations'
      AND column_name = 'taxa_parcelado_' || i || '_pct'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.organizations ADD COLUMN %I numeric(5,2)',
        'taxa_parcelado_' || i || '_pct'
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN public.organizations.taxa_parcelado_2_pct IS 'Taxa para pagamento em 2 parcelas (%).';
-- Comentários para 3..12 podem ser adicionados igualmente se desejar.
