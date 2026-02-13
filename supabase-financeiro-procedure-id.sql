-- ============================================================
-- FINANCEIRO: vínculo receita por procedimento
-- Alinha com PROCEDIMENTOS-MELHORIAS-IDEA.md (receita por procedimento).
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

-- Adiciona procedure_id na tabela financeiro (se existir)
DO $migrate$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financeiro') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financeiro' AND column_name = 'procedure_id'
    ) THEN
      ALTER TABLE public.financeiro ADD COLUMN procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $migrate$;
