-- ============================================================
-- Corrige erro: "unrecognized configuration parameter app.org_id"
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

-- 1) Remove as políticas que este script cria (para poder rodar de novo)
DROP POLICY IF EXISTS "Org members can read clients" ON public.clients;
DROP POLICY IF EXISTS "Org members can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Org members can update clients" ON public.clients;

-- 2) Liga RLS na tabela
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 3) Cria políticas corretas (sem usar app.org_id)
CREATE POLICY "Org members can read clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can insert clients"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can update clients"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid())
  );

-- Se ainda der erro de app.org_id: no Supabase, Table Editor -> clients -> aba Policies,
-- apague qualquer outra politica que aparecer (que nao seja estas 3) e rode este script de novo.
