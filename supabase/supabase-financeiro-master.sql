-- ============================================================
-- Financeiro Master: contas a pagar, fluxo de caixa, reserva,
-- metas e participação nos lucros (master e sócios).
-- Acesso: apenas usuário com role 'master' na organização.
-- ============================================================

-- 1) Contas a pagar (compromissos futuros; quando pago vira saída no financeiro se quiser)
CREATE TABLE IF NOT EXISTS public.contas_a_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  valor numeric NOT NULL CHECK (valor > 0),
  data_vencimento date NOT NULL,
  data_pago date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  categoria text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_org ON public.contas_a_pagar(org_id);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_vencimento ON public.contas_a_pagar(org_id, data_vencimento);
COMMENT ON TABLE public.contas_a_pagar IS 'Contas a pagar por org; visível apenas para master.';

-- 2) Metas financeiras (reserva de emergência, meta de receita, etc.)
CREATE TABLE IF NOT EXISTS public.financeiro_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('reserva_emergencia', 'receita_mensal', 'lucro_mensal', 'outro')),
  valor_meta numeric NOT NULL CHECK (valor_meta >= 0),
  periodo_ref text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financeiro_metas_org ON public.financeiro_metas(org_id);
COMMENT ON TABLE public.financeiro_metas IS 'Metas (reserva de emergência, receita, etc.); apenas master.';

-- 3) Participação nos lucros (master e sócios)
CREATE TABLE IF NOT EXISTS public.participacao_lucros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('master', 'socio')),
  nome_label text NOT NULL,
  percentual numeric CHECK (percentual IS NULL OR (percentual >= 0 AND percentual <= 100)),
  valor_fixo numeric CHECK (valor_fixo IS NULL OR valor_fixo >= 0),
  periodo_ref text NOT NULL,
  valor_calculado numeric,
  pago_em date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participacao_percentual_ou_fixo CHECK (percentual IS NOT NULL OR valor_fixo IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_participacao_lucros_org ON public.participacao_lucros(org_id);
CREATE INDEX IF NOT EXISTS idx_participacao_lucros_periodo ON public.participacao_lucros(org_id, periodo_ref);
COMMENT ON TABLE public.participacao_lucros IS 'Participação nos lucros (master/sócios) por período; apenas master.';

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tr_contas_a_pagar_updated ON public.contas_a_pagar;
CREATE TRIGGER tr_contas_a_pagar_updated BEFORE UPDATE ON public.contas_a_pagar
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS tr_financeiro_metas_updated ON public.financeiro_metas;
CREATE TRIGGER tr_financeiro_metas_updated BEFORE UPDATE ON public.financeiro_metas
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS tr_participacao_lucros_updated ON public.participacao_lucros;
CREATE TRIGGER tr_participacao_lucros_updated BEFORE UPDATE ON public.participacao_lucros
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- 4) RLS: apenas master da org pode ver e alterar
ALTER TABLE public.contas_a_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participacao_lucros ENABLE ROW LEVEL SECURITY;

-- Helper: usuário é master na org da linha
CREATE OR REPLACE FUNCTION public.is_master_for_org(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_users
    WHERE org_id = p_org_id AND user_id = auth.uid() AND role = 'master'
  );
$$;

-- Contas a pagar: só master
DROP POLICY IF EXISTS "master select contas_a_pagar" ON public.contas_a_pagar;
CREATE POLICY "master select contas_a_pagar" ON public.contas_a_pagar FOR SELECT TO authenticated
  USING (public.is_master_for_org(org_id));

DROP POLICY IF EXISTS "master insert contas_a_pagar" ON public.contas_a_pagar;
CREATE POLICY "master insert contas_a_pagar" ON public.contas_a_pagar FOR INSERT TO authenticated
  WITH CHECK (public.is_master_for_org(org_id));

DROP POLICY IF EXISTS "master update contas_a_pagar" ON public.contas_a_pagar;
CREATE POLICY "master update contas_a_pagar" ON public.contas_a_pagar FOR UPDATE TO authenticated
  USING (public.is_master_for_org(org_id)) WITH CHECK (public.is_master_for_org(org_id));

DROP POLICY IF EXISTS "master delete contas_a_pagar" ON public.contas_a_pagar;
CREATE POLICY "master delete contas_a_pagar" ON public.contas_a_pagar FOR DELETE TO authenticated
  USING (public.is_master_for_org(org_id));

-- Financeiro metas: só master
DROP POLICY IF EXISTS "master select financeiro_metas" ON public.financeiro_metas;
CREATE POLICY "master select financeiro_metas" ON public.financeiro_metas FOR SELECT TO authenticated
  USING (public.is_master_for_org(org_id));

DROP POLICY IF EXISTS "master insert financeiro_metas" ON public.financeiro_metas;
CREATE POLICY "master insert financeiro_metas" ON public.financeiro_metas FOR INSERT TO authenticated
  WITH CHECK (public.is_master_for_org(org_id));

DROP POLICY IF EXISTS "master update financeiro_metas" ON public.financeiro_metas;
CREATE POLICY "master update financeiro_metas" ON public.financeiro_metas FOR UPDATE TO authenticated
  USING (public.is_master_for_org(org_id)) WITH CHECK (public.is_master_for_org(org_id));

DROP POLICY IF EXISTS "master delete financeiro_metas" ON public.financeiro_metas;
CREATE POLICY "master delete financeiro_metas" ON public.financeiro_metas FOR DELETE TO authenticated
  USING (public.is_master_for_org(org_id));

-- Participação lucros: só master
DROP POLICY IF EXISTS "master select participacao_lucros" ON public.participacao_lucros;
CREATE POLICY "master select participacao_lucros" ON public.participacao_lucros FOR SELECT TO authenticated
  USING (public.is_master_for_org(org_id));

DROP POLICY IF EXISTS "master insert participacao_lucros" ON public.participacao_lucros;
CREATE POLICY "master insert participacao_lucros" ON public.participacao_lucros FOR INSERT TO authenticated
  WITH CHECK (public.is_master_for_org(org_id));

DROP POLICY IF EXISTS "master update participacao_lucros" ON public.participacao_lucros;
CREATE POLICY "master update participacao_lucros" ON public.participacao_lucros FOR UPDATE TO authenticated
  USING (public.is_master_for_org(org_id)) WITH CHECK (public.is_master_for_org(org_id));

DROP POLICY IF EXISTS "master delete participacao_lucros" ON public.participacao_lucros;
CREATE POLICY "master delete participacao_lucros" ON public.participacao_lucros FOR DELETE TO authenticated
  USING (public.is_master_for_org(org_id));
