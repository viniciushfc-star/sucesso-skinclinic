-- Taxas por bandeira (estilo PagSeguro) — opcional.
-- Estrutura JSONB: { "visa": { "debito": 1.2, "credito_avista": 2.5, "parcelado_2_6": 3.2, "parcelado_7_12": 4.0 }, "master": {...}, "elo": {...} }

DO $migrate$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'taxas_bandeiras'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN taxas_bandeiras jsonb DEFAULT NULL;
  END IF;
END $migrate$;

COMMENT ON COLUMN public.organizations.taxas_bandeiras IS 'Taxas por bandeira (Visa, Master, Elo): débito, crédito à vista, parcelado 2-6x e 7-12x (%). Referência estilo PagSeguro.';
