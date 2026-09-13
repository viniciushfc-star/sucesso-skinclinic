-- ============================================================
-- Agenda: registro de "lembrete enviado" (confirmação por link)
-- Permite exibir "Lembrete enviado" na lista do dia e evitar duplicidade.
-- ============================================================

ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

COMMENT ON COLUMN public.agenda.reminder_sent_at IS 'Data/hora em que foi enviado lembrete ou link de confirmação ao cliente (WhatsApp ou copiado).';
