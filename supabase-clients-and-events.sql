-- ============================================================
-- Clientes + Eventos (Evento ≠ Decisão ≠ Execução)
-- Execute no Supabase: SQL Editor → New query → Cole e Run
-- ============================================================

-- 1️⃣ Tabela clients (estender se já existir, ou criar)
-- Se já tiver tabela clients com org_id, name, email, phone, status:
-- adicione as colunas abaixo. Caso contrário, crie a tabela completa.

-- Opção A: Criar tabela do zero (comente se clients já existir)
/*
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  birth_date date,
  sex text,
  notes text,
  state text NOT NULL DEFAULT 'em_acompanhamento'
    CHECK (state IN ('pre_cadastro','em_acompanhamento','pausado','alta','arquivado')),
  responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT clients_identifier CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
*/

-- Opção B: Só adicionar colunas (descomente e ajuste se clients já existir)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS state text DEFAULT 'em_acompanhamento',
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Garantir constraint de estado (se a coluna state já existir com outro nome, use status e mapeie no app)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'state'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN state text DEFAULT 'em_acompanhamento';
  END IF;
END $$;

-- Remover constraint antiga de status se existir e quiser usar state
-- ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS ...;

-- 2️⃣ Tabela client_events (Evento — nunca confundir com Decisão/Execução)
CREATE TABLE IF NOT EXISTS public.client_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text,
  event_date date DEFAULT current_date,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_client boolean DEFAULT false,
  is_critical boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_events_client_id ON public.client_events(client_id);
CREATE INDEX IF NOT EXISTS idx_client_events_org_id ON public.client_events(org_id);
CREATE INDEX IF NOT EXISTS idx_client_events_event_date ON public.client_events(event_date DESC);

-- 3️⃣ RLS clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read clients" ON public.clients;
CREATE POLICY "Org members can read clients"
  ON public.clients FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can insert clients" ON public.clients;
CREATE POLICY "Org members can insert clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can update clients" ON public.clients;
CREATE POLICY "Org members can update clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- 4️⃣ RLS client_events
ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read client_events" ON public.client_events;
CREATE POLICY "Org members can read client_events"
  ON public.client_events FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can insert client_events" ON public.client_events;
CREATE POLICY "Org members can insert client_events"
  ON public.client_events FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- 5️⃣ Sessão do cliente (portal) — se não existir
CREATE TABLE IF NOT EXISTS public.client_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_sessions_token ON public.client_sessions(token);

ALTER TABLE public.client_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org can manage client_sessions" ON public.client_sessions;
CREATE POLICY "Org can manage client_sessions"
  ON public.client_sessions FOR ALL TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- 6️⃣ RPC: cliente relata evento (portal) — valida token e insere com created_by_client = true
CREATE OR REPLACE FUNCTION public.report_client_event(
  p_token text,
  p_event_type text,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_event_id uuid;
BEGIN
  IF p_token IS NULL OR p_token = '' OR p_event_type IS NULL OR p_event_type = '' THEN
    RAISE EXCEPTION 'Token e tipo do evento são obrigatórios';
  END IF;

  SELECT client_id, org_id INTO v_session
  FROM public.client_sessions
  WHERE token = p_token AND expires_at > now()
  LIMIT 1;

  IF v_session.client_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;

  INSERT INTO public.client_events (
    org_id, client_id, event_type, description,
    created_by_user_id, created_by_client, is_critical
  ) VALUES (
    v_session.org_id, v_session.client_id, p_event_type, p_description,
    NULL, true, false
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;
