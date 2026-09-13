-- ============================================================
-- SALAS × TIPOS DE PROCEDIMENTO × PROFISSIONAIS
-- Evita gargalo: várias salas e profissionais por horário;
-- cada sala suporta certos tipos de procedimento; cruza na hora de agendar.
-- ============================================================

-- 1) Sala: quais tipos de procedimento esta sala suporta (facial, corporal, capilar, injetaveis)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'salas' AND column_name = 'procedimento_tipos'
  ) THEN
    ALTER TABLE public.salas ADD COLUMN procedimento_tipos jsonb NOT NULL DEFAULT '[]';
  END IF;
END $$;

COMMENT ON COLUMN public.salas.procedimento_tipos IS 'Tipos de procedimento que esta sala suporta: ["facial","corporal","capilar","injetaveis"]. Usado no agendamento para não alocar procedimento em sala incompatível.';

-- 2) Procedimento: tipo para cruzar com sala (qual sala pode receber este procedimento)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'procedures' AND column_name = 'tipo_procedimento'
  ) THEN
    ALTER TABLE public.procedures ADD COLUMN tipo_procedimento text;
  END IF;
END $$;

COMMENT ON COLUMN public.procedures.tipo_procedimento IS 'Tipo para cruzar com sala: facial, corporal, capilar, injetaveis. Null = qualquer sala (comportamento antigo).';

-- 3) Profissional × Procedimentos: quais procedimentos cada profissional realiza (evita agendar em profissional que não faz)
CREATE TABLE IF NOT EXISTS public.professional_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id, procedure_id)
);

CREATE INDEX IF NOT EXISTS idx_professional_procedures_org_user ON public.professional_procedures(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_professional_procedures_procedure ON public.professional_procedures(org_id, procedure_id);

COMMENT ON TABLE public.professional_procedures IS 'Quais procedimentos cada profissional realiza. Se vazio para o profissional, considera que pode fazer todos (comportamento antigo).';

ALTER TABLE public.professional_procedures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members professional_procedures" ON public.professional_procedures;
CREATE POLICY "org members professional_procedures" ON public.professional_procedures
  FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
