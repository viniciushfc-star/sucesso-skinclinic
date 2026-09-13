-- Pacote único: rode este arquivo no SQL Editor do Supabase (uma vez).
-- Cobre lembrete automático, lista de espera, Google/fidelidade e colunas da agenda pública.

ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS google_review_url text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS fidelidade_visitas integer DEFAULT 10;

CREATE TABLE IF NOT EXISTS public.agenda_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NULL,
  nome text NOT NULL,
  phone text NULL,
  procedure_name text NULL,
  preferred_date date NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'aberta',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_waitlist_org_status ON public.agenda_waitlist(org_id, status);

ALTER TABLE public.agenda_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org agenda_waitlist" ON public.agenda_waitlist;
CREATE POLICY "org agenda_waitlist" ON public.agenda_waitlist
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- Pasta fiscal (contador) — também em supabase-fiscal-contador.sql
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
