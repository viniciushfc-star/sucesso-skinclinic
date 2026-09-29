-- Imagem no portfólio + canal de venda da clínica (PF e/ou profissional).
-- Cole no SQL Editor se a live ainda não tiver as colunas.

ALTER TABLE public.estoque_produtos
  ADD COLUMN IF NOT EXISTS imagem_url text;

COMMENT ON COLUMN public.estoque_produtos.imagem_url IS 'Foto do produto (URL Storage). O nome continua único no portfólio.';

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS vende_para_cliente boolean NOT NULL DEFAULT true;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS vende_para_profissional boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.vende_para_cliente IS 'Clínica vende produto para pessoa física / cliente final.';
COMMENT ON COLUMN public.organizations.vende_para_profissional IS 'Clínica revende para profissional. Desligado = esconde preço B2B.';
