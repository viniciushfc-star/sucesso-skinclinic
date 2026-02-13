-- ============================================================
-- Corrige 400 em organizations e 404 em team_payment_models
-- Rode no SQL Editor do Supabase (Dashboard → SQL Editor → New query → Cole e Run)
-- ============================================================

-- 1) Colunas que faltam em organizations (evita 400 Bad Request)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'cep') THEN
    ALTER TABLE public.organizations ADD COLUMN cep text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'complemento') THEN
    ALTER TABLE public.organizations ADD COLUMN complemento text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'menu_anamnese_visible') THEN
    ALTER TABLE public.organizations ADD COLUMN menu_anamnese_visible boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'brinde_aniversario_habilitado') THEN
    ALTER TABLE public.organizations ADD COLUMN brinde_aniversario_habilitado boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'nota_fiscal_emitir_url') THEN
    ALTER TABLE public.organizations ADD COLUMN nota_fiscal_emitir_url text;
  END IF;
END $$;

-- 2) Tabela team_payment_models (evita 404 Not Found)
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

-- Trigger updated_at (função pode já existir)
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
