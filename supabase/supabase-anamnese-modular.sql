-- ============================================================
-- ANAMNESE MODULAR — três tipos: Injetáveis (alto risco), Corporal (antropometria + bioimpedância), Procedimentos simples (baixo risco)
-- Compatível com anamnesis_funcoes e anamnesis_registros existentes.
-- Ordem: rode após supabase-anamnese-canon.sql e supabase-anamnese-ficha-fotos.sql
-- ============================================================

-- 1) Tipos de anamnese (fixos por risco)
CREATE TABLE IF NOT EXISTS public.anamnesis_tipos (
  id text PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  risco text NOT NULL DEFAULT 'medio' CHECK (risco IN ('alto', 'medio', 'baixo')),
  ordem int NOT NULL DEFAULT 0
);

INSERT INTO public.anamnesis_tipos (id, nome, descricao, risco, ordem) VALUES
  ('injetaveis', 'Injetáveis', 'Toxina, preenchimento, bioestimulador. Alto risco.', 'alto', 1),
  ('corporal', 'Corporal', 'Antropometria, bioimpedância, avaliação corporal.', 'medio', 2),
  ('simples', 'Procedimentos simples', 'Limpeza de pele, peelings superficiais, baixo risco.', 'baixo', 3)
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, risco = EXCLUDED.risco, ordem = EXCLUDED.ordem;

COMMENT ON TABLE public.anamnesis_tipos IS 'Tipos fixos de anamnese por nível de risco. Cada função (rosto_pele, rosto_injetaveis, corporal) mapeia para um tipo.';

-- 2) Vínculo função → tipo (por org, opcional; senão inferido por slug)
CREATE TABLE IF NOT EXISTS public.anamnesis_funcao_tipo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  funcao_id uuid NOT NULL REFERENCES public.anamnesis_funcoes(id) ON DELETE CASCADE,
  tipo_id text NOT NULL REFERENCES public.anamnesis_tipos(id) ON DELETE RESTRICT,
  UNIQUE(org_id, funcao_id)
);
CREATE INDEX IF NOT EXISTS idx_anamnesis_funcao_tipo_org ON public.anamnesis_funcao_tipo(org_id);

-- 3) Regras configuráveis por tipo (motor de regras em JSON)
CREATE TABLE IF NOT EXISTS public.anamnesis_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tipo_id text NOT NULL REFERENCES public.anamnesis_tipos(id) ON DELETE CASCADE,
  nome text,
  nivel text NOT NULL CHECK (nivel IN ('contraindicacao_absoluta', 'contraindicacao_relativa', 'alerta', 'info')),
  bloqueia_procedimento boolean NOT NULL DEFAULT false,
  regra jsonb NOT NULL DEFAULT '{}',
  ordem int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anamnesis_regras_org_tipo ON public.anamnesis_regras(org_id, tipo_id) WHERE active = true;
COMMENT ON COLUMN public.anamnesis_regras.regra IS 'Condições em JSON: { "conditions": [ { "field": "ficha.gestante", "op": "eq", "value": "sim" } ], "message": "..." }';

-- 4) Colunas novas em anamnesis_registros
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'anamnesis_registros' AND column_name = 'tipo_anamnese') THEN
    ALTER TABLE public.anamnesis_registros ADD COLUMN tipo_anamnese text REFERENCES public.anamnesis_tipos(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'anamnesis_registros' AND column_name = 'score_result') THEN
    ALTER TABLE public.anamnesis_registros ADD COLUMN score_result jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'anamnesis_registros' AND column_name = 'bloqueio_procedimento') THEN
    ALTER TABLE public.anamnesis_registros ADD COLUMN bloqueio_procedimento boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'anamnesis_registros' AND column_name = 'version') THEN
    ALTER TABLE public.anamnesis_registros ADD COLUMN version int NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'anamnesis_registros' AND column_name = 'anthropometry') THEN
    ALTER TABLE public.anamnesis_registros ADD COLUMN anthropometry jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'anamnesis_registros' AND column_name = 'resultado_resumo') THEN
    ALTER TABLE public.anamnesis_registros ADD COLUMN resultado_resumo text;
  END IF;
END $$;

COMMENT ON COLUMN public.anamnesis_registros.resultado_resumo IS 'Resumo textual opcional do resultado (antes/depois), usado em laudos e materiais para o cliente.';
COMMENT ON COLUMN public.anamnesis_registros.score_result IS 'Resultado do motor de regras: { "score", "nivel_pior", "bloqueio", "alertas": [] }';
COMMENT ON COLUMN public.anamnesis_registros.anthropometry IS 'Dados corporais: peso, altura, circunferências, bioimpedância, IMC, RCQ, waist_height_ratio, classificacao_metabolica';

-- 5) Catálogos dinâmicos (admin edita opções de selects por tipo/org)
CREATE TABLE IF NOT EXISTS public.anamnesis_catalogos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tipo_id text REFERENCES public.anamnesis_tipos(id) ON DELETE CASCADE,
  slug text NOT NULL,
  nome text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  ordem int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, tipo_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_anamnesis_catalogos_org_tipo ON public.anamnesis_catalogos(org_id, tipo_id) WHERE active = true;

-- 6) Log de auditoria (alterações em registros)
CREATE TABLE IF NOT EXISTS public.anamnesis_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  registro_id uuid NOT NULL REFERENCES public.anamnesis_registros(id) ON DELETE CASCADE,
  action text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anamnesis_audit_registro ON public.anamnesis_audit_log(registro_id);
CREATE INDEX IF NOT EXISTS idx_anamnesis_audit_org ON public.anamnesis_audit_log(org_id, created_at DESC);

-- 7) Assinatura digital (por registro)
CREATE TABLE IF NOT EXISTS public.anamnesis_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id uuid NOT NULL REFERENCES public.anamnesis_registros(id) ON DELETE CASCADE,
  signer_type text NOT NULL CHECK (signer_type IN ('profissional', 'cliente', 'responsavel')),
  signer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id uuid,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_or_hash text,
  UNIQUE(registro_id, signer_type)
);
CREATE INDEX IF NOT EXISTS idx_anamnesis_assinaturas_registro ON public.anamnesis_assinaturas(registro_id);

-- 8) RLS
ALTER TABLE public.anamnesis_funcao_tipo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anamnesis_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anamnesis_catalogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anamnesis_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anamnesis_assinaturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org anamnesis_funcao_tipo" ON public.anamnesis_funcao_tipo;
CREATE POLICY "org anamnesis_funcao_tipo" ON public.anamnesis_funcao_tipo FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "org anamnesis_regras" ON public.anamnesis_regras;
CREATE POLICY "org anamnesis_regras" ON public.anamnesis_regras FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "org anamnesis_catalogos" ON public.anamnesis_catalogos;
CREATE POLICY "org anamnesis_catalogos" ON public.anamnesis_catalogos FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "org anamnesis_audit_log" ON public.anamnesis_audit_log;
CREATE POLICY "org anamnesis_audit_log" ON public.anamnesis_audit_log FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- anamnesis_assinaturas: acesso via registro (org através de anamnesis_registros)
DROP POLICY IF EXISTS "org anamnesis_assinaturas" ON public.anamnesis_assinaturas;
CREATE POLICY "org anamnesis_assinaturas" ON public.anamnesis_assinaturas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.anamnesis_registros r
      WHERE r.id = anamnesis_assinaturas.registro_id
        AND r.org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.anamnesis_registros r
      WHERE r.id = anamnesis_assinaturas.registro_id
        AND r.org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
    )
  );

-- 9) Campos personalizados por função (cada clínica adiciona conforme demanda; ficha com a cara da clínica)
CREATE TABLE IF NOT EXISTS public.anamnesis_campos_personalizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  funcao_id uuid NOT NULL REFERENCES public.anamnesis_funcoes(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'textarea', 'select', 'sim_nao', 'number', 'section')),
  placeholder text,
  options jsonb DEFAULT '[]',
  ordem int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, funcao_id, key)
);
CREATE INDEX IF NOT EXISTS idx_anamnesis_campos_personalizados_org_funcao ON public.anamnesis_campos_personalizados(org_id, funcao_id) WHERE active = true;

COMMENT ON TABLE public.anamnesis_campos_personalizados IS 'Campos extras por área/função. Cada clínica adiciona com + conforme demanda; os valores vão no mesmo ficha (registro).';

ALTER TABLE public.anamnesis_campos_personalizados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org anamnesis_campos_personalizados" ON public.anamnesis_campos_personalizados;
CREATE POLICY "org anamnesis_campos_personalizados" ON public.anamnesis_campos_personalizados FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- 10) analise_pele: origem (profissional vs cliente) para fluxo diferenciado
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'origem') THEN
    ALTER TABLE public.analise_pele ADD COLUMN origem text DEFAULT 'cliente' CHECK (origem IN ('cliente', 'profissional'));
  END IF;
END $$;
COMMENT ON COLUMN public.analise_pele.origem IS 'cliente = formulário objetivo no portal; profissional = anamnese completa na clínica. Usado para exibir/validar de forma diferenciada.';
