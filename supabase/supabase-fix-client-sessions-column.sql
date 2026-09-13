-- ============================================================
-- CORREÇÃO: client_sessions precisa da coluna "client_id"
-- O erro "column client_id does not exist" acontece quando a função
-- get_client_session_by_token (portal) faz SELECT s.client_id de
-- client_sessions, mas a tabela tem "cliente_id" em vez de "client_id".
--
-- Rode este script ANTES de supabase-analise-pele-ia.sql (e antes
-- de supabase-client-registration-portal.sql se ainda não rodou).
-- ============================================================

-- 1) Se a tabela client_sessions nem existir, crie com client_id
--    (depende de organizations e clients ou clientes existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_sessions') THEN
    -- Cria client_sessions com client_id (referência a clients ou clientes)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
      CREATE TABLE public.client_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
        token text UNIQUE NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz DEFAULT now()
      );
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clientes') THEN
      CREATE TABLE public.client_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        client_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
        token text UNIQUE NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz DEFAULT now()
      );
    ELSE
      RAISE EXCEPTION 'Crie antes a tabela de clientes (clients ou clientes) e organizations.';
    END IF;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_sessions_token ON public.client_sessions(token);
    ALTER TABLE public.client_sessions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Org can manage client_sessions" ON public.client_sessions
      FOR ALL TO authenticated
      USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
    RAISE NOTICE 'Tabela client_sessions criada com coluna client_id.';
    RETURN;
  END IF;

  -- 2) Se já existe e tem cliente_id mas não client_id, renomeia
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_sessions' AND column_name = 'cliente_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_sessions' AND column_name = 'client_id') THEN
    ALTER TABLE public.client_sessions RENAME COLUMN cliente_id TO client_id;
    RAISE NOTICE 'Coluna cliente_id renomeada para client_id em client_sessions.';
    RETURN;
  END IF;

  -- 3) Se tem client_id, nada a fazer
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_sessions' AND column_name = 'client_id') THEN
    RAISE NOTICE 'client_sessions já possui coluna client_id.';
    RETURN;
  END IF;

  RAISE EXCEPTION 'client_sessions existe mas não tem client_id nem cliente_id. Verifique a estrutura da tabela.';
END $$;
