-- CEP e endereço no cadastro do cliente (não na ficha de anamnese).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text;

COMMENT ON COLUMN public.clients.cep IS 'CEP do cadastro da pessoa.';
