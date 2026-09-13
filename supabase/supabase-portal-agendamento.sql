-- Agendamento e remarcação pelo portal do cliente (self-service).
-- Depende de: get_client_session_by_token, tabela agenda, procedures.

ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS origem text;

COMMENT ON COLUMN public.agenda.origem IS 'clinica | portal — quem criou o agendamento.';

CREATE OR REPLACE FUNCTION public.list_portal_procedures(p_token text)
RETURNS TABLE (id uuid, name text, duration_minutes int, valor_cobrado numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT s.org_id INTO v_org FROM get_client_session_by_token(p_token) AS s LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  RETURN QUERY
  SELECT p.id, p.name, coalesce(p.duration_minutes, 60), p.valor_cobrado
  FROM public.procedures p
  WHERE p.org_id = v_org AND coalesce(p.active, true) = true
  ORDER BY p.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_portal_busy_hours(p_token text, p_data date)
RETURNS TABLE (hora time)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT s.org_id INTO v_org FROM get_client_session_by_token(p_token) AS s LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  RETURN QUERY
  SELECT a.hora
  FROM public.agenda a
  WHERE a.org_id = v_org
    AND a.data = p_data
    AND a.hora IS NOT NULL
    AND a.cancelled_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_portal_appointments(p_token text)
RETURNS TABLE (
  id uuid,
  data date,
  hora time,
  procedimento text,
  procedure_name text,
  duration_minutes int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
  v_org uuid;
BEGIN
  SELECT s.client_id, s.org_id INTO v_client, v_org
  FROM get_client_session_by_token(p_token) AS s LIMIT 1;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  RETURN QUERY
  SELECT
    a.id,
    a.data,
    a.hora,
    a.procedimento,
    pr.name,
    coalesce(a.duration_minutes, pr.duration_minutes, 60)
  FROM public.agenda a
  LEFT JOIN public.procedures pr ON pr.id = a.procedure_id
  WHERE a.org_id = v_org
    AND a.cliente_id = v_client
    AND a.cancelled_at IS NULL
    AND a.data >= current_date
  ORDER BY a.data, a.hora;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_portal_appointment(
  p_token text,
  p_data date,
  p_hora time,
  p_procedure_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
  v_org uuid;
  v_name text;
  v_dur int;
  v_id uuid;
  v_busy int;
  v_future int;
BEGIN
  SELECT s.client_id, s.org_id INTO v_client, v_org
  FROM get_client_session_by_token(p_token) AS s LIMIT 1;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  IF p_data IS NULL OR p_hora IS NULL THEN
    RAISE EXCEPTION 'Informe data e horário';
  END IF;
  IF p_data < current_date THEN
    RAISE EXCEPTION 'Não é possível agendar no passado';
  END IF;

  SELECT count(*) INTO v_future
  FROM public.agenda
  WHERE org_id = v_org AND cliente_id = v_client AND cancelled_at IS NULL AND data >= current_date;
  IF v_future >= 8 THEN
    RAISE EXCEPTION 'Limite de horários futuros atingido. Remarque ou cancele um existente.';
  END IF;

  SELECT count(*) INTO v_busy
  FROM public.agenda
  WHERE org_id = v_org AND data = p_data AND hora = p_hora AND cancelled_at IS NULL;
  IF v_busy > 0 THEN
    RAISE EXCEPTION 'Horário indisponível. Escolha outro.';
  END IF;

  SELECT p.name, coalesce(p.duration_minutes, 60) INTO v_name, v_dur
  FROM public.procedures p
  WHERE p.id = p_procedure_id AND p.org_id = v_org AND coalesce(p.active, true) = true;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Procedimento inválido';
  END IF;

  INSERT INTO public.agenda (
    org_id, cliente_id, data, hora, procedimento, procedure_id, duration_minutes, origem
  ) VALUES (
    v_org, v_client, p_data, p_hora, v_name, p_procedure_id, v_dur, 'portal'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_portal_appointment(
  p_token text,
  p_agenda_id uuid,
  p_data date,
  p_hora time
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
  v_org uuid;
  v_busy int;
BEGIN
  SELECT s.client_id, s.org_id INTO v_client, v_org
  FROM get_client_session_by_token(p_token) AS s LIMIT 1;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  IF p_data < current_date THEN
    RAISE EXCEPTION 'Não é possível remarcar para o passado';
  END IF;

  SELECT count(*) INTO v_busy
  FROM public.agenda
  WHERE org_id = v_org AND data = p_data AND hora = p_hora AND cancelled_at IS NULL
    AND id <> p_agenda_id;
  IF v_busy > 0 THEN
    RAISE EXCEPTION 'Horário indisponível. Escolha outro.';
  END IF;

  UPDATE public.agenda
  SET data = p_data, hora = p_hora
  WHERE id = p_agenda_id AND org_id = v_org AND cliente_id = v_client AND cancelled_at IS NULL
    AND data >= current_date;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado ou já passou';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_portal_appointment(p_token text, p_agenda_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
  v_org uuid;
BEGIN
  SELECT s.client_id, s.org_id INTO v_client, v_org
  FROM get_client_session_by_token(p_token) AS s LIMIT 1;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;

  UPDATE public.agenda
  SET cancelled_at = now()
  WHERE id = p_agenda_id AND org_id = v_org AND cliente_id = v_client
    AND cancelled_at IS NULL AND data >= current_date;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível cancelar';
  END IF;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_portal_procedures(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_portal_busy_hours(text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_portal_appointments(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_portal_appointment(text, date, time, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_portal_appointment(text, uuid, date, time) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_portal_appointment(text, uuid) TO anon, authenticated;
