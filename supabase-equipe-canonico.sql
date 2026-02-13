-- ============================================================
-- Equipe — modelo de pagamento (só master) e afazeres
-- Canon: registrar modelo para análise; não expor em tela operacional.
-- Afazeres: responsável, prazo, auditoria; não ocupam agenda.
-- ============================================================

-- 1) Modelo de pagamento por membro (visível só para master)
CREATE TABLE IF NOT EXISTS public.team_payment_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_type text NOT NULL CHECK (payment_type IN ('fixo', 'percentual', 'diaria', 'combinado')),
  valor_fixo numeric CHECK (valor_fixo IS NULL OR valor_fixo >= 0),
  percentual_procedimento numeric CHECK (percentual_procedimento IS NULL OR (percentual_procedimento >= 0 AND percentual_procedimento <= 100)),
  valor_diaria numeric CHECK (valor_diaria IS NULL OR valor_diaria >= 0),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_payment_models_org ON public.team_payment_models(org_id);
COMMENT ON TABLE public.team_payment_models IS 'Modelo de pagamento por membro (só master). Sistema registra para análise; não executa pagamento.';

ALTER TABLE public.team_payment_models ENABLE ROW LEVEL SECURITY;

-- Apenas master da org pode ver/alterar (policy por linha)
DROP POLICY IF EXISTS "master select team_payment_models" ON public.team_payment_models;
CREATE POLICY "master select team_payment_models" ON public.team_payment_models FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_users ou WHERE ou.org_id = team_payment_models.org_id AND ou.user_id = auth.uid() AND ou.role = 'master'));
DROP POLICY IF EXISTS "master insert team_payment_models" ON public.team_payment_models;
CREATE POLICY "master insert team_payment_models" ON public.team_payment_models FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_users ou WHERE ou.org_id = team_payment_models.org_id AND ou.user_id = auth.uid() AND ou.role = 'master'));
DROP POLICY IF EXISTS "master update team_payment_models" ON public.team_payment_models;
CREATE POLICY "master update team_payment_models" ON public.team_payment_models FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_users ou WHERE ou.org_id = team_payment_models.org_id AND ou.user_id = auth.uid() AND ou.role = 'master'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_users ou WHERE ou.org_id = team_payment_models.org_id AND ou.user_id = auth.uid() AND ou.role = 'master'));
DROP POLICY IF EXISTS "master delete team_payment_models" ON public.team_payment_models;
CREATE POLICY "master delete team_payment_models" ON public.team_payment_models FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_users ou WHERE ou.org_id = team_payment_models.org_id AND ou.user_id = auth.uid() AND ou.role = 'master'));

-- 2) Afazeres (tarefas com responsável e prazo; não ocupam agenda)
CREATE TABLE IF NOT EXISTS public.afazeres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  responsavel_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  prazo date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_afazeres_org ON public.afazeres(org_id);
CREATE INDEX IF NOT EXISTS idx_afazeres_responsavel ON public.afazeres(org_id, responsavel_user_id);
CREATE INDEX IF NOT EXISTS idx_afazeres_prazo ON public.afazeres(org_id, prazo);
COMMENT ON TABLE public.afazeres IS 'Tarefas com responsável e prazo; não ocupam agenda de atendimento.';

ALTER TABLE public.afazeres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members afazeres" ON public.afazeres;
CREATE POLICY "org members afazeres" ON public.afazeres FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- Triggers updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tr_team_payment_models_updated ON public.team_payment_models;
CREATE TRIGGER tr_team_payment_models_updated BEFORE UPDATE ON public.team_payment_models
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS tr_afazeres_updated ON public.afazeres;
CREATE TRIGGER tr_afazeres_updated BEFORE UPDATE ON public.afazeres
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
