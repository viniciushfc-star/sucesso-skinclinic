-- P1-9: eventos de 5xx / webhook + leitura de custo de IA pela org (master/gestor).

CREATE TABLE IF NOT EXISTS public.api_error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  route text,
  method text,
  status integer NOT NULL DEFAULT 0,
  duration_ms integer,
  kind text NOT NULL DEFAULT 'api_5xx',
  message text,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_error_events_org_created
  ON public.api_error_events (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_org_created
  ON public.ai_usage_events (org_id, created_at DESC);

ALTER TABLE public.api_error_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_error_events_select_gestor" ON public.api_error_events;
CREATE POLICY "api_error_events_select_gestor"
  ON public.api_error_events
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT ou.org_id
      FROM public.organization_users ou
      WHERE ou.user_id = auth.uid()
        AND ou.role IN ('master', 'gestor')
    )
  );

DROP POLICY IF EXISTS "ai_usage_events_select_gestor" ON public.ai_usage_events;
CREATE POLICY "ai_usage_events_select_gestor"
  ON public.ai_usage_events
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT ou.org_id
      FROM public.organization_users ou
      WHERE ou.user_id = auth.uid()
        AND ou.role IN ('master', 'gestor')
    )
  );

COMMENT ON TABLE public.api_error_events IS
  'P1-9: 5xx e falha de webhook. INSERT só service role. Sem body/token.';
