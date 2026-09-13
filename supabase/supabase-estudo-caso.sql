-- ============================================================
-- ESTUDO DE CASO (Camada 3 do Protocolo) — casos anonimizados + perguntas para aprender
-- Alinha com PROTOCOLO-IDEIA-AMADURECIDA.md: máx. 2–3 métricas; profissional faz perguntas e esclarece dúvidas após leitura.
-- ============================================================

-- 1) Casos anonimizados vinculados ao protocolo (sem client_id; só perfil + resposta)
CREATE TABLE IF NOT EXISTS public.estudo_casos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  protocolo_id uuid NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  tipo_pele text,
  queixa_principal text,
  resposta_observada text NOT NULL CHECK (resposta_observada IN ('melhora', 'sem_mudanca', 'efeito_adverso')),
  n_sessoes integer,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_estudo_casos_org ON public.estudo_casos(org_id);
CREATE INDEX IF NOT EXISTS idx_estudo_casos_protocolo ON public.estudo_casos(protocolo_id);
CREATE INDEX IF NOT EXISTS idx_estudo_casos_resposta ON public.estudo_casos(protocolo_id, resposta_observada);
COMMENT ON TABLE public.estudo_casos IS 'Casos anonimizados para estudo (método + histórico). Sem client_id; só perfil (tipo_pele, queixa) e resposta observada.';

-- 2) Perguntas do profissional sobre o caso + esclarecimento após leitura (para aprender de verdade)
CREATE TABLE IF NOT EXISTS public.estudo_caso_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudo_caso_id uuid NOT NULL REFERENCES public.estudo_casos(id) ON DELETE CASCADE,
  pergunta text NOT NULL,
  resposta_ia text,
  artigo_contexto text,
  tipo text NOT NULL DEFAULT 'pergunta' CHECK (tipo IN ('pergunta', 'esclarecer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_estudo_caso_perguntas_caso ON public.estudo_caso_perguntas(estudo_caso_id);
COMMENT ON TABLE public.estudo_caso_perguntas IS 'Perguntas pertinentes do profissional sobre o caso; e dúvidas após leitura de artigo (esclarecer para aprender).';

-- 3) RLS
ALTER TABLE public.estudo_casos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org members estudo casos" ON public.estudo_casos;
CREATE POLICY "org members estudo casos" ON public.estudo_casos
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

ALTER TABLE public.estudo_caso_perguntas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org members estudo caso perguntas" ON public.estudo_caso_perguntas;
CREATE POLICY "org members estudo caso perguntas" ON public.estudo_caso_perguntas
  FOR ALL TO authenticated
  USING (
    estudo_caso_id IN (
      SELECT id FROM public.estudo_casos
      WHERE org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    estudo_caso_id IN (
      SELECT id FROM public.estudo_casos
      WHERE org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
    )
  );
