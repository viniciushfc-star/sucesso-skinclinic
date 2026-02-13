-- ============================================================
-- ANAMNESE: ficha por área/queixa, fotos e conduta do tratamento
-- Áreas: Capilar (cabelo), Rosto (Pele / Injetáveis), Corporal
-- ============================================================

-- 1) Novas colunas em anamnesis_registros
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'anamnesis_registros' AND column_name = 'ficha') THEN
    ALTER TABLE public.anamnesis_registros ADD COLUMN ficha jsonb DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'anamnesis_registros' AND column_name = 'fotos') THEN
    ALTER TABLE public.anamnesis_registros ADD COLUMN fotos jsonb DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'anamnesis_registros' AND column_name = 'conduta_tratamento') THEN
    ALTER TABLE public.anamnesis_registros ADD COLUMN conduta_tratamento text;
  END IF;
  -- conteudo pode ficar vazio quando a ficha preenche
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'anamnesis_registros' AND column_name = 'conteudo') THEN
    ALTER TABLE public.anamnesis_registros ALTER COLUMN conteudo DROP NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.anamnesis_registros.ficha IS 'Dados estruturados da ficha por área (queixa principal, fototipo, etc.).';
COMMENT ON COLUMN public.anamnesis_registros.fotos IS 'URLs das fotos anexadas (array).';
COMMENT ON COLUMN public.anamnesis_registros.conduta_tratamento IS 'Plano/conduta do tratamento e próximos passos.';

-- 2) Garantir valor default em conteudo para inserts antigos
UPDATE public.anamnesis_registros SET conteudo = '' WHERE conteudo IS NULL;
ALTER TABLE public.anamnesis_registros ALTER COLUMN conteudo SET DEFAULT '';

-- 3) Novas funções (áreas por queixa): Capilar, Rosto - Pele, Rosto - Injetáveis, Corporal
-- Inserir apenas se a org não tiver; o app chama ensureDefaultFuncoes com esses slugs.
-- Não alteramos registros existentes; o app usa listFuncoes que já retorna da tabela.

-- 4) Bucket para fotos da anamnese (rodar no Supabase Dashboard > Storage se não existir)
-- Criar bucket "anamnese-fotos" (público ou privado com RLS por org).
-- Política sugerida: usuários autenticados da org podem inserir/ler em objetos onde nome começa com org_id.
