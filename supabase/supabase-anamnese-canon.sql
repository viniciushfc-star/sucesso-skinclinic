-- ============================================================
-- ANAMNESE (canon): funções clínicas + registros evolutivos
-- Pele é função da anamnese, não módulo isolado.
-- O atendimento conduz; o sistema acompanha.
-- ============================================================

-- 1) Funções clínicas da anamnese (Pele, Corporal, Capilar, etc.)
CREATE TABLE IF NOT EXISTS public.anamnesis_funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  slug text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_anamnesis_funcoes_org ON public.anamnesis_funcoes(org_id) WHERE active = true;

COMMENT ON TABLE public.anamnesis_funcoes IS 'Funções clínicas da anamnese (Pele, Corporal, Capilar). Ativadas pelo tipo de atendimento.';

-- 2) Registros evolutivos da anamnese (cumulativos, nunca apagados)
CREATE TABLE IF NOT EXISTS public.anamnesis_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  funcao_id uuid NOT NULL REFERENCES public.anamnesis_funcoes(id) ON DELETE RESTRICT,
  agenda_id uuid NULL,
  conteudo text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anamnesis_registros_client_funcao ON public.anamnesis_registros(client_id, funcao_id);
CREATE INDEX IF NOT EXISTS idx_anamnesis_registros_agenda ON public.anamnesis_registros(agenda_id) WHERE agenda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_anamnesis_registros_org ON public.anamnesis_registros(org_id);

COMMENT ON TABLE public.anamnesis_registros IS 'Registros evolutivos da anamnese por função. Sempre com data e contexto de atendimento (agenda_id). Nunca sobrescreve.';
COMMENT ON COLUMN public.anamnesis_registros.agenda_id IS 'Contexto do atendimento que gerou este registro (opcional mas recomendado).';

-- 3) RLS: anamnesis_funcoes
ALTER TABLE public.anamnesis_funcoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members anamnesis_funcoes" ON public.anamnesis_funcoes;
CREATE POLICY "org members anamnesis_funcoes" ON public.anamnesis_funcoes
  FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- 4) RLS: anamnesis_registros
ALTER TABLE public.anamnesis_registros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members anamnesis_registros" ON public.anamnesis_registros;
CREATE POLICY "org members anamnesis_registros" ON public.anamnesis_registros
  FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- 5) Seed de funções padrão por organização (via trigger ou insert manual na primeira vez)
-- Opcional: função para garantir funções padrão ao criar org (ou rodar uma vez por org existente)
-- Aqui apenas o insert para orgs que queiram seeds; cada org pode ter suas próprias funções.
-- INSERT exemplar (rodar manual ou por app):
-- INSERT INTO public.anamnesis_funcoes (org_id, nome, slug, ordem) VALUES
--   ('<org_id>', 'Pele', 'pele', 1),
--   ('<org_id>', 'Corporal', 'corporal', 2),
--   ('<org_id>', 'Capilar', 'capilar', 3)
-- ON CONFLICT (org_id, slug) DO NOTHING;
