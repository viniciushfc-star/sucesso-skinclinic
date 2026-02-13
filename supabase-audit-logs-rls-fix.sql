-- ============================================================
-- Corrige erro: "unrecognized configuration parameter app.org_id"
-- na tabela audit_logs (leitura na tela Auditoria).
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

-- 1) Remove políticas de SELECT antigas (podem usar app.org_id)
DROP POLICY IF EXISTS "audit_logs_select_org" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can read own org audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Org members can read audit_logs" ON public.audit_logs;
-- Se existir política com outro nome que use app.org_id, remova manualmente em Table Editor -> audit_logs -> Policies

-- 2) Garante RLS ativo
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3) Política de SELECT: usuário vê apenas audit_logs da sua organização (sem usar app.org_id)
CREATE POLICY "audit_logs_select_org"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );

-- 4) Política de INSERT (para o app registrar eventos) – mesma lógica
DROP POLICY IF EXISTS "audit_logs_insert_org" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_org"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );
