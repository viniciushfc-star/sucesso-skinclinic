-- ============================================================
-- ROTINA DE SKINCARE POR CLIENTE — liberação no portal
-- Clínica monta/edita rotina; libera para o cliente ver no portal.
-- Monetização: clínica libera por valor/pacote (cobrança manual ou futura integração).
-- ============================================================

-- 1) Tabela: uma rotina ativa por cliente (última versão; histórico opcional depois)
CREATE TABLE IF NOT EXISTS public.skincare_rotinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  conteudo text NOT NULL DEFAULT '',
  liberado_em timestamptz,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_skincare_rotinas_org ON public.skincare_rotinas(org_id);
CREATE INDEX IF NOT EXISTS idx_skincare_rotinas_client ON public.skincare_rotinas(client_id);
CREATE INDEX IF NOT EXISTS idx_skincare_rotinas_liberado ON public.skincare_rotinas(org_id) WHERE liberado_em IS NOT NULL;

-- FK client_id → clients (ou clientes conforme existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'skincare_rotinas' AND constraint_name = 'fk_skincare_rotinas_client') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
      ALTER TABLE public.skincare_rotinas ADD CONSTRAINT fk_skincare_rotinas_client FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clientes') THEN
      ALTER TABLE public.skincare_rotinas ADD CONSTRAINT fk_skincare_rotinas_client FOREIGN KEY (client_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

COMMENT ON TABLE public.skincare_rotinas IS 'Rotina de skincare por cliente. Clínica edita; liberado_em preenchido = cliente vê no portal.';
COMMENT ON COLUMN public.skincare_rotinas.liberado_em IS 'Quando a clínica liberou a rotina no portal (monetização: cobrar antes de liberar).';

-- 2) RLS
ALTER TABLE public.skincare_rotinas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members skincare_rotinas" ON public.skincare_rotinas;
CREATE POLICY "org members skincare_rotinas"
  ON public.skincare_rotinas
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- 3) RPC: portal obtém rotina do cliente (só se liberada)
CREATE OR REPLACE FUNCTION public.get_skincare_rotina_by_token(p_token text)
RETURNS TABLE (id uuid, conteudo text, liberado_em timestamptz, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_org_id uuid;
BEGIN
  SELECT s.client_id, s.org_id INTO v_client_id, v_org_id
  FROM get_client_session_by_token(p_token) AS s(client_id uuid, org_id uuid, expires_at timestamptz, registration_completed_at timestamptz)
  LIMIT 1;
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  RETURN QUERY
  SELECT r.id, r.conteudo, r.liberado_em, r.updated_at
  FROM public.skincare_rotinas r
  WHERE r.client_id = v_client_id AND r.org_id = v_org_id AND r.liberado_em IS NOT NULL
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_skincare_rotina_by_token IS 'Portal: cliente vê sua rotina de skincare somente se a clínica tiver liberado.';
