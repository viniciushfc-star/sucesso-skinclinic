-- Cobrança pelo app. Cole no SQL Editor e Run. Idempotente.
-- Só existe o registro. A cobrança de verdade fica desligada até a parceria
-- com maquininhas (PAGAMENTO_APP_ENABLED + PAGAMENTO_PARCEIRO_KEY). O caixa não muda sozinho.
-- Mercado de referência: 1% por parcela; taxa de uso no app é menor.

CREATE TABLE IF NOT EXISTS public.cobrancas_app (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NULL,
  agenda_id uuid NULL,
  valor numeric(12,2) NOT NULL,
  metodo text NOT NULL DEFAULT 'pix',
  parcelas int NOT NULL DEFAULT 1,
  descricao text NULL,
  status text NOT NULL DEFAULT 'aguardando_parceiro',
  parceiro_ref text NULL,
  financeiro_id uuid NULL,
  criado_por uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobrancas_app_org ON public.cobrancas_app(org_id, created_at DESC);

ALTER TABLE public.cobrancas_app ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org cobrancas_app" ON public.cobrancas_app;
CREATE POLICY "org cobrancas_app" ON public.cobrancas_app
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

COMMENT ON TABLE public.cobrancas_app IS
  'Pedido de cobrança pelo app. Sem parceria a API recusa. Caixa só com confirmação humana.';

-- Interesse da clínica na parceria (não cobra). Um registro por org.
CREATE TABLE IF NOT EXISTS public.pagamento_adesao (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'interesse',
  volume_mensal numeric(14,2) NULL,
  recado text NULL,
  user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pagamento_adesao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org pagamento_adesao" ON public.pagamento_adesao;
CREATE POLICY "org pagamento_adesao" ON public.pagamento_adesao
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

COMMENT ON TABLE public.pagamento_adesao IS
  'Fila da parceria com maquininhas. Interesse não dispara cobrança.';
