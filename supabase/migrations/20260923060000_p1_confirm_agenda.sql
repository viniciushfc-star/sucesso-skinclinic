-- Confirmação pelo link: marca o horário na agenda da clínica, não só a tabela de tokens.
-- Cole no SQL Editor do Supabase.

ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

COMMENT ON COLUMN public.agenda.confirmed_at IS 'Cliente confirmou o horário pelo link (WhatsApp/portal).';

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

ALTER TABLE public.appointment_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members appointment_confirmations" ON public.appointment_confirmations;
CREATE POLICY "org members appointment_confirmations"
  ON public.appointment_confirmations
  FOR ALL
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

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

  UPDATE public.agenda
  SET confirmed_at = now()
  WHERE id = v_row.appointment_id
    AND org_id = v_row.org_id
    AND cancelled_at IS NULL;

  RETURN jsonb_build_object('ok', true, 'appointment_id', v_row.appointment_id);
END;
$func$;

REVOKE ALL ON FUNCTION public.confirm_appointment_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_appointment_by_token(text) TO anon, authenticated;

COMMENT ON FUNCTION public.confirm_appointment_by_token(text) IS
  'Cliente confirma horário pelo token do link. Atualiza agenda.confirmed_at da mesma org.';
