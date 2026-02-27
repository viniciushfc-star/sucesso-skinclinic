-- ============================================================
-- FINANCEIRO: vínculo com agenda (dar baixa → entrada com agenda_id)
-- Permite mostrar no dashboard "concluídos hoje" (o que já foi dado baixa).
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

DO $migrate$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financeiro') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financeiro' AND column_name = 'agenda_id'
    ) THEN
      ALTER TABLE public.financeiro ADD COLUMN agenda_id uuid REFERENCES public.agenda(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $migrate$;

CREATE INDEX IF NOT EXISTS idx_financeiro_agenda_id ON public.financeiro(agenda_id) WHERE agenda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financeiro_data_agenda ON public.financeiro(data) WHERE tipo = 'entrada' AND agenda_id IS NOT NULL;

COMMENT ON COLUMN public.financeiro.agenda_id IS 'Preenchido quando a entrada veio de "Dar baixa" na agenda; permite cruzar concluídos no dashboard.';
