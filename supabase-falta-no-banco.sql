-- ============================================================
-- O que falta no banco: tabelas que o app usa mas não têm
-- CREATE TABLE em nenhum outro script deste repositório.
-- Rode no Supabase → SQL Editor (após ter organizations e organization_users).
-- ============================================================

-- 1) Convites da equipe (Convidar usuário, lista em Configurações, aceitar convite)
-- Coluna org_id para ficar igual a organization_users e evitar erro 42703.
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('master', 'gestor', 'staff', 'viewer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Se a tabela já existia com organization_id (ex.: versão antiga do script), migra para org_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_invites' AND column_name = 'organization_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_invites' AND column_name = 'org_id') THEN
    ALTER TABLE public.organization_invites ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    UPDATE public.organization_invites SET org_id = organization_id WHERE org_id IS NULL;
    ALTER TABLE public.organization_invites ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE public.organization_invites DROP COLUMN organization_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organization_invites_org ON public.organization_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_email_status ON public.organization_invites(email, status);

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can manage invites" ON public.organization_invites;
CREATE POLICY "org members can manage invites" ON public.organization_invites
  FOR ALL TO authenticated
  USING (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );

COMMENT ON TABLE public.organization_invites IS 'Convites para entrar na organização. Coluna org_id. Lista em Configurações (master); aceitar convite atualiza status para accepted.';


-- 2) Registros compartilhados com o cliente (portal: "Orientações recentes", prontuário)
-- Descomente e ajuste colunas se sua regra usar client_id + protocol_id ou só client_id.
/*
CREATE TABLE IF NOT EXISTS public.client_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  protocol_id uuid,
  record_type text NOT NULL,
  content jsonb DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'shared')),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_records_org_client ON public.client_records(org_id, client_id);
ALTER TABLE public.client_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org client_records" ON public.client_records FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
*/


-- 3) Tratamento ativo no portal (view ou tabela)
-- O portal faz: .from("client_protocols").select("*").eq("status", "active").single()
-- Você pode criar uma VIEW que retorna o protocolo ativo do cliente (por token/sessão) ou uma tabela client_protocols.
-- Exemplo de view (ajuste conforme suas tabelas de protocolo/cliente):
/*
CREATE OR REPLACE VIEW public.client_protocols AS
  SELECT
    p.id,
    p.org_id,
    p.client_id,
    'active'::text AS status,
    p.created_at,
    p.updated_at
  FROM public.protocolos_aplicados p
  WHERE p.status = 'active' OR 1=1;
-- Ajuste a condição conforme sua regra (ex.: apenas um protocolo ativo por cliente).
*/


-- 4) Profiles (nomes na equipe) — opcional
-- Muitos projetos criam profiles ligado a auth.users. Exemplo mínimo:
/*
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  avatar_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());
*/


-- 5) Notificações (agenda: avisos)
/*
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  mensagem text,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_org_lida ON public.notificacoes(org_id, lida);
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org notificacoes" ON public.notificacoes FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
*/
