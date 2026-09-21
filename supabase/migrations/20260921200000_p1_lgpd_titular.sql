-- P1-10: trilha de pedidos LGPD + marca de exclusão no cadastro canônico.
-- Agenda/financeiro não são apagados pelo app.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lgpd_erased_at timestamptz;

CREATE TABLE IF NOT EXISTS public.lgpd_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid,
  kind text NOT NULL CHECK (kind IN ('export', 'erase')),
  status text NOT NULL DEFAULT 'completed',
  counts jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lgpd_requests_org_created
  ON public.lgpd_requests (org_id, created_at DESC);

ALTER TABLE public.lgpd_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lgpd_requests_select_gestor" ON public.lgpd_requests;
CREATE POLICY "lgpd_requests_select_gestor"
  ON public.lgpd_requests
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT ou.org_id
      FROM public.organization_users ou
      WHERE ou.user_id = auth.uid()
        AND ou.role IN ('master', 'gestor')
    )
  );

DROP POLICY IF EXISTS "lgpd_requests_insert_member" ON public.lgpd_requests;
CREATE POLICY "lgpd_requests_insert_member"
  ON public.lgpd_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.lgpd_requests IS
  'P1-10: pedido de portabilidade ou exclusão. Não é prova de conformidade jurídica.';
COMMENT ON COLUMN public.clients.lgpd_erased_at IS
  'Quando preenchido, PII do titular foi anonimizado. Agenda/financeiro podem permanecer.';
