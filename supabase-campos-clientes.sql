-- ============================================================
-- Campos e tabelas que faltam para o cadastro completo de clientes
-- Execute no Supabase: SQL Editor → New query → Cole e Run
-- ============================================================

-- 1️⃣ Colunas que faltam na tabela clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS state text DEFAULT 'em_acompanhamento',
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2️⃣ Tabela de eventos do cliente (linha do tempo)
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

ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read client_events" ON public.client_events;
CREATE POLICY "Org members can read client_events"
  ON public.client_events FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can insert client_events" ON public.client_events;
CREATE POLICY "Org members can insert client_events"
  ON public.client_events FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid()));

-- 3️⃣ Tabela de sessão do cliente (portal com link/token)
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
  USING (org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid()));

-- 4️⃣ Função para o cliente relatar evento pelo portal (usa token)
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
