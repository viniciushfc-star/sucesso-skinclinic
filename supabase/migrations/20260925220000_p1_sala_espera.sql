-- Sala de espera: recepção marca Chegou / Em atendimento.
-- Não dispara WhatsApp. Cole no SQL Editor.

ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz;

ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

COMMENT ON COLUMN public.agenda.arrived_at IS 'Paciente chegou à recepção (sala de espera).';
COMMENT ON COLUMN public.agenda.started_at IS 'Atendimento começou (saiu da espera).';
