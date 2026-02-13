-- Link para o sistema de emissão de nota fiscal (prefeitura ou contador).
-- Usado na tela Notas fiscais → Emitir nota fiscal.
DO $migrate$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'nota_fiscal_emitir_url') THEN
    ALTER TABLE public.organizations ADD COLUMN nota_fiscal_emitir_url text;
  END IF;
END $migrate$;

COMMENT ON COLUMN public.organizations.nota_fiscal_emitir_url IS 'URL do sistema de emissão de NFS-e/NF-e (prefeitura ou contador). Exibida em Notas fiscais → Emitir nota fiscal.';
