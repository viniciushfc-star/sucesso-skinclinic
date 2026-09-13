-- ============================================================
-- FIX: Adicionar colunas ausentes em analise_pele
-- Use este script se aparecer erro "column consentimento_imagens does not exist"
-- (tabela criada com estrutura antiga)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'consentimento_imagens') THEN
    ALTER TABLE public.analise_pele ADD COLUMN consentimento_imagens boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'menor_responsavel') THEN
    ALTER TABLE public.analise_pele ADD COLUMN menor_responsavel text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'imagens') THEN
    ALTER TABLE public.analise_pele ADD COLUMN imagens jsonb NOT NULL DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'respostas') THEN
    ALTER TABLE public.analise_pele ADD COLUMN respostas jsonb NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'ia_preliminar') THEN
    ALTER TABLE public.analise_pele ADD COLUMN ia_preliminar text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'status') THEN
    ALTER TABLE public.analise_pele ADD COLUMN status text NOT NULL DEFAULT 'pending_validation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'validado_por') THEN
    ALTER TABLE public.analise_pele ADD COLUMN validado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'validado_em') THEN
    ALTER TABLE public.analise_pele ADD COLUMN validado_em timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'texto_validado') THEN
    ALTER TABLE public.analise_pele ADD COLUMN texto_validado text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'anamnesis_registro_id') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'anamnesis_registros') THEN
      ALTER TABLE public.analise_pele ADD COLUMN anamnesis_registro_id uuid REFERENCES public.anamnesis_registros(id) ON DELETE SET NULL;
    ELSE
      ALTER TABLE public.analise_pele ADD COLUMN anamnesis_registro_id uuid;
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'created_at') THEN
    ALTER TABLE public.analise_pele ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Comentários (opcional; não quebram se a coluna já existir)
COMMENT ON COLUMN public.analise_pele.consentimento_imagens IS 'Cliente autorizou uso das imagens apenas para análise e validação pela clínica.';
