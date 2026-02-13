-- ============================================================
-- PLANOS TERAPÊUTICOS (resposta à dor do cliente + procedimentos)
-- Alinha com PLANO-CANONICO.md. Plano mora dentro de Procedimentos.
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

-- 1) Tabela de planos terapêuticos (por organização)
CREATE TABLE IF NOT EXISTS public.planos_terapeuticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  dor_cliente text,
  explicacao_terapeutica text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planos_terapeuticos_org ON public.planos_terapeuticos(org_id);
COMMENT ON TABLE public.planos_terapeuticos IS 'Planos terapêuticos: resposta estruturada a uma dor do cliente, composta por procedimentos.';
COMMENT ON COLUMN public.planos_terapeuticos.dor_cliente IS 'Qual dor esse plano trata (para o cliente).';
COMMENT ON COLUMN public.planos_terapeuticos.explicacao_terapeutica IS 'Por que esses procedimentos juntos fazem sentido; lógica do caminho.';

-- 2) Vínculo plano ↔ procedimentos (ordem e quantidade opcional)
CREATE TABLE IF NOT EXISTS public.planos_terapeuticos_procedimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES public.planos_terapeuticos(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  quantidade int NOT NULL DEFAULT 1,
  UNIQUE(plano_id, procedure_id)
);

CREATE INDEX IF NOT EXISTS idx_planos_terapeuticos_proc_plano ON public.planos_terapeuticos_procedimentos(plano_id);
CREATE INDEX IF NOT EXISTS idx_planos_terapeuticos_proc_procedure ON public.planos_terapeuticos_procedimentos(procedure_id);

-- 3) RLS
ALTER TABLE public.planos_terapeuticos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org members planos terapeuticos" ON public.planos_terapeuticos;
CREATE POLICY "org members planos terapeuticos" ON public.planos_terapeuticos
  FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

ALTER TABLE public.planos_terapeuticos_procedimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org members planos terapeuticos proc" ON public.planos_terapeuticos_procedimentos;
CREATE POLICY "org members planos terapeuticos proc" ON public.planos_terapeuticos_procedimentos
  FOR ALL
  USING (
    plano_id IN (
      SELECT id FROM public.planos_terapeuticos
      WHERE org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    plano_id IN (
      SELECT id FROM public.planos_terapeuticos
      WHERE org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
    )
  );
