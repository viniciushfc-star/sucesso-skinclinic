-- ============================================================
-- Cria a tabela audit_logs e configura RLS (Auditoria)
-- Se a tela de Auditoria mostrar "não foi possível carregar",
-- execute este script no Supabase: SQL Editor → New query → Cole e Run
-- ============================================================

-- 1) Criar tabela audit_logs (se não existir)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,

  role_technical text,
  job_title text,

  action text NOT NULL,
  table_name text,
  record_id text,
  permission_used text,
  metadata jsonb DEFAULT '{}',

  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  acknowledged_by_email text,

  starred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  starred_at timestamptz,
  starred_by_email text
);

COMMENT ON TABLE public.audit_logs IS 'Log de auditoria por organização; usado na tela Auditoria e por audit.service.js';
COMMENT ON COLUMN public.audit_logs.org_id IS 'Organização à qual o evento pertence';
COMMENT ON COLUMN public.audit_logs.action IS 'Tipo de ação (ex.: financeiro.create, cliente.update)';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Dados extras em JSON (ex.: completed_by_client, client_name)';

-- 2) Colunas opcionais (caso a tabela já exista sem elas — pule se der erro "column already exists")
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'acknowledged_by') THEN
    ALTER TABLE public.audit_logs ADD COLUMN acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'acknowledged_at') THEN
    ALTER TABLE public.audit_logs ADD COLUMN acknowledged_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'acknowledged_by_email') THEN
    ALTER TABLE public.audit_logs ADD COLUMN acknowledged_by_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'starred_by') THEN
    ALTER TABLE public.audit_logs ADD COLUMN starred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'starred_at') THEN
    ALTER TABLE public.audit_logs ADD COLUMN starred_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'starred_by_email') THEN
    ALTER TABLE public.audit_logs ADD COLUMN starred_by_email text;
  END IF;
END $$;

-- 3) Permitir user_id e user_email nulos (eventos do portal do cliente)
ALTER TABLE public.audit_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN user_email DROP NOT NULL;

-- 4) Índice para listagem por org e data
CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx
  ON public.audit_logs (org_id, created_at DESC);

-- 5) Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 6) Remover políticas antigas (evita conflito)
DROP POLICY IF EXISTS "audit_logs_select_org" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_org" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_acknowledge" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can read own org audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Org members can read audit_logs" ON public.audit_logs;

-- 7) SELECT: usuário vê apenas registros da sua organização
CREATE POLICY "audit_logs_select_org"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.organization_users
      WHERE user_id = auth.uid()
    )
  );

-- 8) INSERT: usuário pode inserir apenas na própria organização
CREATE POLICY "audit_logs_insert_org"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.organization_users
      WHERE user_id = auth.uid()
    )
  );

-- 9) UPDATE: master/gestor podem atualizar (dar ok, estrela) na própria organização
CREATE POLICY "audit_logs_update_acknowledge"
  ON public.audit_logs
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.organization_users
      WHERE user_id = auth.uid()
      AND role IN ('master', 'gestor')
    )
  )
  WITH CHECK (true);
