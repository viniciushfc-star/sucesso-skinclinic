-- ============================================================
-- Adiciona campos de "estrela" na auditoria (audit_logs)
-- e permite ao master/gestor marcar itens importantes.
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS starred_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS starred_at timestamptz,
  ADD COLUMN IF NOT EXISTS starred_by_email text;

COMMENT ON COLUMN public.audit_logs.starred_by IS 'Usuário que marcou o item como importante (estrela)';
COMMENT ON COLUMN public.audit_logs.starred_at IS 'Data/hora em que o item foi marcado como importante';
COMMENT ON COLUMN public.audit_logs.starred_by_email IS 'E-mail de quem marcou como importante';

-- A política de UPDATE já existe em supabase-audit-logs-acknowledge.sql
-- e permite a master/gestor atualizar audit_logs da própria organização.
-- Não é necessário criar nova policy só para estrela.

