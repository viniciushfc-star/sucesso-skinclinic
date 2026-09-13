-- ============================================================
-- TAXAS DA OPERADORA (banco da clínica) — Precificação e simulador
-- A clínica informa as taxas reais do contrato com o banco;
-- o sistema usa para mostrar quanto ela realmente recebe por parcela e
-- até quantas parcelas / quanto de desconto à vista faz sentido.
-- ============================================================

DO $migrate$
BEGIN
  -- Taxa à vista (% sobre o valor da transação)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'taxa_avista_pct') THEN
    ALTER TABLE public.organizations ADD COLUMN taxa_avista_pct numeric(5,2);
  END IF;
  -- Taxa parcelado 2x a 6x (%)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'taxa_parcelado_2_6_pct') THEN
    ALTER TABLE public.organizations ADD COLUMN taxa_parcelado_2_6_pct numeric(5,2);
  END IF;
  -- Taxa parcelado 7x a 12x (%)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'taxa_parcelado_7_12_pct') THEN
    ALTER TABLE public.organizations ADD COLUMN taxa_parcelado_7_12_pct numeric(5,2);
  END IF;
END $migrate$;

COMMENT ON COLUMN public.organizations.taxa_avista_pct IS 'Taxa da operadora para pagamento à vista (%). Usado no simulador de precificação.';
COMMENT ON COLUMN public.organizations.taxa_parcelado_2_6_pct IS 'Taxa da operadora para parcelamento 2x a 6x (%).';
COMMENT ON COLUMN public.organizations.taxa_parcelado_7_12_pct IS 'Taxa da operadora para parcelamento 7x a 12x (%).';
