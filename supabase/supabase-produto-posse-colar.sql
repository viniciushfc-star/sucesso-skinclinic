-- Origem do produto: da clínica ou representação de marca.
-- Cole no SQL Editor e Run. Não mistura capital da casa com revenda da marca.

ALTER TABLE public.estoque_produtos
  ADD COLUMN IF NOT EXISTS posse text NOT NULL DEFAULT 'clinica';

ALTER TABLE public.estoque_produtos
  ADD COLUMN IF NOT EXISTS marca_representada text;

DO $$
BEGIN
  ALTER TABLE public.estoque_produtos DROP CONSTRAINT IF EXISTS estoque_produtos_posse_check;
  ALTER TABLE public.estoque_produtos
    ADD CONSTRAINT estoque_produtos_posse_check
    CHECK (posse IN ('clinica', 'representacao'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.estoque_produtos.posse IS 'clinica = estoque da casa. representacao = revenda da marca; não mistura com o capital da clínica.';
COMMENT ON COLUMN public.estoque_produtos.marca_representada IS 'Nome da empresa/marca quando posse = representacao.';
