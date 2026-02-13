-- Confirmação de horário: link por WhatsApp ou portal (cliente confirma com um clique).
-- Rode após a tabela de agenda/appointments existir. appointment_id pode ser agenda.id ou appointments.id conforme seu modelo.

CREATE TABLE IF NOT EXISTS public.appointment_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  confirmed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_confirmations_token ON public.appointment_confirmations(token);
CREATE INDEX IF NOT EXISTS idx_appointment_confirmations_org ON public.appointment_confirmations(org_id);

COMMENT ON TABLE public.appointment_confirmations IS 'Tokens de confirmação de horário (link enviado por WhatsApp ou portal).';

ALTER TABLE public.appointment_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members appointment_confirmations" ON public.appointment_confirmations;
CREATE POLICY "org members appointment_confirmations" ON public.appointment_confirmations
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- RPC: cliente confirma horário pelo link (sem login staff). Usado pelo portal.
CREATE OR REPLACE FUNCTION public.confirm_appointment_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_row record;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token inválido');
  END IF;

  UPDATE public.appointment_confirmations
  SET confirmed_at = now()
  WHERE token = p_token AND confirmed_at IS NULL
  RETURNING id, appointment_id, org_id INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Link já utilizado ou inválido');
  END IF;

  RETURN jsonb_build_object('ok', true, 'appointment_id', v_row.appointment_id);
END;
$func$;

COMMENT ON FUNCTION public.confirm_appointment_by_token(text) IS 'Confirma horário pelo token do link (portal/WhatsApp). Chamado sem autenticação staff.';
