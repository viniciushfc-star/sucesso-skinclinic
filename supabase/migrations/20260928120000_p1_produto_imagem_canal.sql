-- Imagem de produto e canal PF / profissional.

ALTER TABLE public.estoque_produtos
  ADD COLUMN IF NOT EXISTS imagem_url text;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS vende_para_cliente boolean NOT NULL DEFAULT true;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS vende_para_profissional boolean NOT NULL DEFAULT false;
