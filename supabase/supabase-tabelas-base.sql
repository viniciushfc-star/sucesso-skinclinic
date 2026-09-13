-- Tabelas-base que o app usa e ainda não tinham CREATE neste repositório.
-- Seguro em projeto já existente (IF NOT EXISTS). Rode depois de organizations existir.

CREATE TABLE IF NOT EXISTS public.agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  data date,
  hora time,
  procedimento text,
  cliente_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financeiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  data date,
  tipo text,
  valor numeric,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  protocol_id uuid,
  record_type text NOT NULL DEFAULT 'orientacao',
  content jsonb DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'shared' CHECK (visibility IN ('internal', 'shared')),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_records_org_client ON public.client_records(org_id, client_id);

ALTER TABLE public.client_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org client_records" ON public.client_records;
CREATE POLICY "org client_records" ON public.client_records FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.client_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_protocols ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org client_protocols" ON public.client_protocols;
CREATE POLICY "org client_protocols" ON public.client_protocols FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

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
DROP POLICY IF EXISTS "org notificacoes" ON public.notificacoes;
CREATE POLICY "org notificacoes" ON public.notificacoes FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  avatar_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can read all profiles" ON public.profiles;
CREATE POLICY "users can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "users can update own profile" ON public.profiles;
CREATE POLICY "users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  agenda_id uuid,
  channel text,
  destino text,
  status text,
  detalhe text,
  created_at timestamptz NOT NULL DEFAULT now()
);
