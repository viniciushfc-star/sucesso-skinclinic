-- Pasta fiscal + deixa para apuração própria (não transmite imposto).

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS regime_tributario text DEFAULT 'nao_informado';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS aliquota_simples_pct numeric(5,2);

CREATE TABLE IF NOT EXISTS public.fiscal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'outros',
  titulo text NOT NULL,
  file_url text NULL,
  competencia date NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_org ON public.fiscal_documents(org_id);

ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org fiscal_documents" ON public.fiscal_documents;
CREATE POLICY "org fiscal_documents" ON public.fiscal_documents
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.fiscal_apuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  regime text NULL,
  receita_caixa numeric(14,2) NULL,
  aliquota_usada numeric(6,3) NULL,
  imposto_estimado numeric(14,2) NULL,
  status text NOT NULL DEFAULT 'rascunho',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, competencia)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_apuracoes_org ON public.fiscal_apuracoes(org_id);

ALTER TABLE public.fiscal_apuracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org fiscal_apuracoes" ON public.fiscal_apuracoes;
CREATE POLICY "org fiscal_apuracoes" ON public.fiscal_apuracoes
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
