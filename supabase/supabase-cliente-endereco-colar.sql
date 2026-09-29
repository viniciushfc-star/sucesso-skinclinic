-- CEP e endereço no cadastro da pessoa (clients), não na anamnese.
-- SQL Editor → cole e Run.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text;

COMMENT ON COLUMN public.clients.cep IS 'CEP do cadastro da pessoa.';
COMMENT ON COLUMN public.clients.endereco IS 'Logradouro do cadastro da pessoa.';
