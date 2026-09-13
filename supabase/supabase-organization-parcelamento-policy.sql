-- Regra de parcelamento para vendas: margem mínima e teto de parcelas (só master/gestor altera).
-- Quem cobra vê "parcelar em até Nx" para manter o lucro da empresa.
-- Rode após as taxas da maquininha estarem na organizations.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations'
    AND column_name = 'parcelamento_margem_minima_pct'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN parcelamento_margem_minima_pct numeric(5,2) DEFAULT 80;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations'
    AND column_name = 'parcelamento_max_parcelas'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN parcelamento_max_parcelas smallint DEFAULT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.organizations.parcelamento_margem_minima_pct IS 'Margem mínima (% do valor) que a empresa quer manter ao parcelar; usado para sugerir "até Nx" na cobrança.';
COMMENT ON COLUMN public.organizations.parcelamento_max_parcelas IS 'Teto de parcelas a sugerir (ex.: 6). Nulo = calcular pelas taxas para cada valor.';
