-- CEP e complemento no cadastro da empresa (organizations).
-- Rode no SQL Editor do Supabase para habilitar salvamento desses campos.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'cep') THEN
    ALTER TABLE public.organizations ADD COLUMN cep text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'complemento') THEN
    ALTER TABLE public.organizations ADD COLUMN complemento text;
  END IF;
END $$;

COMMENT ON COLUMN public.organizations.cep IS 'CEP da empresa. Usado no cadastro da empresa com busca ViaCEP.';
COMMENT ON COLUMN public.organizations.complemento IS 'Complemento do endereço (sala, bloco, conjunto).';
