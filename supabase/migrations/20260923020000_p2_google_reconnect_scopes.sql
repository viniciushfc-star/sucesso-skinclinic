-- Marca conexões Google antigas para reconectar (FreeBusy + evento genérico).
ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS granted_scopes text;

ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS reconnect_needed boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.google_calendar_connections.granted_scopes IS
  'Escopos OAuth concedidos. Sem calendar.events a clínica não ocupa o horário.';
