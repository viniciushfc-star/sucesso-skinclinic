-- Agenda pública da clínica (link para Instagram/WhatsApp, sem token de cliente).

ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
-- p_org_id é o UUID da organização (já visível no app). Não lista dados de outras clínicas.

CREATE OR REPLACE FUNCTION public.get_public_clinic(p_org_id uuid)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name
  FROM public.organizations o
  WHERE o.id = p_org_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.list_public_procedures(p_org_id uuid)
RETURNS TABLE (id uuid, name text, duration_minutes int)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, coalesce(p.duration_minutes, 60)
  FROM public.procedures p
  WHERE p.org_id = p_org_id AND coalesce(p.active, true) = true
  ORDER BY p.name;
$$;

CREATE OR REPLACE FUNCTION public.list_public_busy_hours(p_org_id uuid, p_data date)
RETURNS TABLE (hora time)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.hora
  FROM public.agenda a
  WHERE a.org_id = p_org_id
    AND a.data = p_data
    AND a.hora IS NOT NULL
    AND a.cancelled_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.create_public_appointment(
  p_org_id uuid,
  p_name text,
  p_phone text,
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
  v_name text;
  v_dur int;
  v_id uuid;
  v_busy int;
  v_today int;
  v_org_today int;
  v_digits text;
  v_clinic int;
BEGIN
  SELECT count(*) INTO v_clinic FROM public.organizations WHERE id = p_org_id;
  IF v_clinic = 0 THEN
    RAISE EXCEPTION 'Clínica não encontrada';
  END IF;
  IF p_data IS NULL OR p_hora IS NULL OR p_data < current_date THEN
    RAISE EXCEPTION 'Data ou horário inválido';
  END IF;
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  IF length(v_digits) < 10 OR length(trim(coalesce(p_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Informe nome e telefone válidos';
  END IF;

  SELECT count(*) INTO v_org_today
  FROM public.agenda
  WHERE org_id = p_org_id AND origem = 'publico' AND data = current_date;
  IF v_org_today >= 80 THEN
    RAISE EXCEPTION 'Agenda pública lotada hoje. Tente pelo WhatsApp da clínica.';
  END IF;

  SELECT p.name, coalesce(p.duration_minutes, 60) INTO v_name, v_dur
  FROM public.procedures p
  WHERE p.id = p_procedure_id AND p.org_id = p_org_id AND coalesce(p.active, true) = true;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Procedimento inválido';
  END IF;

  SELECT count(*) INTO v_busy
  FROM public.agenda
  WHERE org_id = p_org_id AND data = p_data AND hora = p_hora AND cancelled_at IS NULL;
  IF v_busy > 0 THEN
    RAISE EXCEPTION 'Horário indisponível. Escolha outro.';
  END IF;

  SELECT c.id INTO v_client
  FROM public.clients c
  WHERE c.org_id = p_org_id
    AND regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') = v_digits
  LIMIT 1;

  IF v_client IS NULL THEN
    INSERT INTO public.clients (org_id, name, phone)
    VALUES (p_org_id, trim(p_name), v_digits)
    RETURNING id INTO v_client;
  END IF;

  SELECT count(*) INTO v_today
  FROM public.agenda
  WHERE org_id = p_org_id AND cliente_id = v_client AND origem = 'publico'
    AND data >= current_date;
  IF v_today >= 4 THEN
    RAISE EXCEPTION 'Limite de agendamentos por hoje. Fale com a clínica.';
  END IF;

  INSERT INTO public.agenda (
    org_id, cliente_id, data, hora, procedimento, procedure_id, duration_minutes, origem
  ) VALUES (
    p_org_id, v_client, p_data, p_hora, v_name, p_procedure_id, v_dur, 'publico'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_clinic(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_procedures(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_busy_hours(uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_appointment(uuid, text, text, date, time, uuid) TO anon, authenticated;
