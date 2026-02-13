-- ============================================================
-- Contas e cartões vinculados — transações em tempo real
-- Open Finance / agregador (Belvo, Pluggy, etc.) envia transações
-- via webhook; identificamos a conta por external_account_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contas_vinculadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'webhook',
  external_account_id text NOT NULL,
  nome_exibicao text NOT NULL,
  tipo text NOT NULL DEFAULT 'conta' CHECK (tipo IN ('conta', 'cartao')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'error')),
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, provider, external_account_id)
);

CREATE INDEX IF NOT EXISTS idx_contas_vinculadas_org ON public.contas_vinculadas(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_vinculadas_external ON public.contas_vinculadas(external_account_id);
COMMENT ON TABLE public.contas_vinculadas IS 'Contas/cartões vinculados para receber transações em tempo real (webhook ou Open Finance).';

ALTER TABLE public.contas_vinculadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can manage contas_vinculadas" ON public.contas_vinculadas;
CREATE POLICY "org members can manage contas_vinculadas" ON public.contas_vinculadas
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- Webhook precisa inserir em financeiro; não precisa ver contas_vinculadas pelo RLS do user.
-- O webhook roda com service_role e lê contas_vinculadas por external_account_id.

CREATE OR REPLACE FUNCTION public.set_updated_at_contas_vinculadas()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tr_contas_vinculadas_updated ON public.contas_vinculadas;
CREATE TRIGGER tr_contas_vinculadas_updated BEFORE UPDATE ON public.contas_vinculadas
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at_contas_vinculadas();
