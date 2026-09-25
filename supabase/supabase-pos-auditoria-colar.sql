-- SkinClinic — colar UMA vez no SQL Editor (Supabase) e Run.
-- Idempotente: pode repetir. Não apaga dados.
-- Ordem: Google occupy → scopes → auditoria imutável → portal CPF → overlap agenda → confirmação.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ========== 1. 20260923010000_p2_agenda_google_occupy.sql ==========
-- Lote 8: mapeamento agenda clínica → evento genérico no Google (sem PII).

CREATE TABLE IF NOT EXISTS public.agenda_google_events (
  agenda_id uuid PRIMARY KEY REFERENCES public.agenda(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  google_event_id text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_google_events_org_user
  ON public.agenda_google_events (org_id, user_id);

ALTER TABLE public.agenda_google_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members read agenda_google_events" ON public.agenda_google_events;
CREATE POLICY "org members read agenda_google_events"
  ON public.agenda_google_events FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );

COMMENT ON TABLE public.agenda_google_events IS 'Ligação agenda da clínica ↔ evento genérico no Google. Sem nome de paciente.';

-- ========== 2. 20260923020000_p2_google_reconnect_scopes.sql ==========
ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS granted_scopes text;

ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS reconnect_needed boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.google_calendar_connections.granted_scopes IS
  'Escopos OAuth concedidos. Sem calendar.events a clínica não ocupa o horário.';

-- ========== 3. 20260923030000_p0_audit_logs_immutable.sql ==========
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by_email text,
  ADD COLUMN IF NOT EXISTS starred_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS starred_at timestamptz,
  ADD COLUMN IF NOT EXISTS starred_by_email text;

DROP POLICY IF EXISTS "audit_logs_insert_org" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_acknowledge" ON public.audit_logs;

REVOKE INSERT ON TABLE public.audit_logs FROM PUBLIC;
REVOKE INSERT ON TABLE public.audit_logs FROM anon;
REVOKE INSERT ON TABLE public.audit_logs FROM authenticated;
REVOKE UPDATE ON TABLE public.audit_logs FROM PUBLIC;
REVOKE UPDATE ON TABLE public.audit_logs FROM anon;
REVOKE UPDATE ON TABLE public.audit_logs FROM authenticated;
REVOKE DELETE ON TABLE public.audit_logs FROM PUBLIC;
REVOKE DELETE ON TABLE public.audit_logs FROM anon;
REVOKE DELETE ON TABLE public.audit_logs FROM authenticated;

CREATE OR REPLACE FUNCTION public.audit_logs_protect()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_logs are immutable';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.org_id IS DISTINCT FROM OLD.org_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.user_email IS DISTINCT FROM OLD.user_email
      OR NEW.role_technical IS DISTINCT FROM OLD.role_technical
      OR NEW.job_title IS DISTINCT FROM OLD.job_title
      OR NEW.action IS DISTINCT FROM OLD.action
      OR NEW.table_name IS DISTINCT FROM OLD.table_name
      OR NEW.record_id IS DISTINCT FROM OLD.record_id
      OR NEW.permission_used IS DISTINCT FROM OLD.permission_used
      OR NEW.metadata IS DISTINCT FROM OLD.metadata
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'audit_logs identity is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_protect_trg ON public.audit_logs;
CREATE TRIGGER audit_logs_protect_trg
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE PROCEDURE public.audit_logs_protect();

-- ========== 4. 20260923040000_p1_portal_rpc_cpf.sql ==========
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS consent_terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_image_use boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_terms_version text;

DROP FUNCTION IF EXISTS public.get_client_by_token(text);

CREATE FUNCTION public.get_client_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  name text,
  phone text,
  email text,
  cpf text,
  birth_date date,
  sex text,
  registration_completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_session RECORD;
  v_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN;
  END IF;
  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'::text), 'hex');
  SELECT s.client_id, s.org_id INTO v_session
  FROM public.client_sessions s
  WHERE s.revoked_at IS NULL
    AND s.expires_at > now()
    AND (s.token_hash = v_hash OR (s.token_hash IS NULL AND s.token = p_token))
  LIMIT 1;
  IF v_session.client_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.phone,
    c.email,
    CASE WHEN c.registration_completed_at IS NULL THEN c.cpf ELSE NULL END,
    c.birth_date::date,
    c.sex,
    c.registration_completed_at
  FROM public.clients c
  WHERE c.id = v_session.client_id AND c.org_id = v_session.org_id
  LIMIT 1;
END;
$func$;

REVOKE ALL ON FUNCTION public.get_client_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.client_complete_registration(
  p_token text,
  p_name text,
  p_phone text,
  p_email text,
  p_birth_date date DEFAULT NULL,
  p_sex text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_consent_terms_accepted boolean DEFAULT false,
  p_consent_image_use boolean DEFAULT false,
  p_consent_terms_version text DEFAULT 'v1'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_session RECORD;
  v_client_id uuid;
  v_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token invalido';
  END IF;
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Nome e obrigatorio';
  END IF;
  IF (p_phone IS NULL OR trim(p_phone) = '') AND (p_email IS NULL OR trim(p_email) = '') THEN
    RAISE EXCEPTION 'Informe telefone ou e-mail';
  END IF;
  IF NOT (COALESCE(p_consent_terms_accepted, false)) THEN
    RAISE EXCEPTION 'E obrigatorio aceitar o Termo de Consentimento para continuar';
  END IF;

  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'::text), 'hex');
  SELECT s.client_id, s.org_id INTO v_session
  FROM public.client_sessions s
  WHERE s.revoked_at IS NULL
    AND s.expires_at > now()
    AND (s.token_hash = v_hash OR (s.token_hash IS NULL AND s.token = p_token))
  LIMIT 1;

  IF v_session.client_id IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida ou expirada';
  END IF;

  v_client_id := v_session.client_id;

  UPDATE public.clients
  SET
    name = trim(p_name),
    phone = nullif(trim(p_phone), ''),
    email = nullif(trim(p_email), ''),
    birth_date = p_birth_date,
    sex = nullif(trim(p_sex), ''),
    cpf = CASE
      WHEN p_cpf IS NOT NULL AND trim(regexp_replace(p_cpf, '[^0-9]', '', 'g')) ~ '^\d{11}$'
      THEN trim(regexp_replace(p_cpf, '[^0-9]', '', 'g'))
      ELSE cpf
    END,
    registration_completed_at = now(),
    consent_terms_accepted_at = CASE WHEN p_consent_terms_accepted THEN now() ELSE consent_terms_accepted_at END,
    consent_image_use = CASE WHEN p_consent_terms_accepted THEN COALESCE(p_consent_image_use, false) ELSE consent_image_use END,
    consent_terms_version = CASE WHEN p_consent_terms_accepted THEN nullif(trim(p_consent_terms_version), '') ELSE consent_terms_version END
  WHERE id = v_client_id AND org_id = v_session.org_id;

  INSERT INTO public.audit_logs (
    org_id,
    user_id,
    user_email,
    role_technical,
    job_title,
    action,
    table_name,
    record_id,
    permission_used,
    metadata
  ) VALUES (
    v_session.org_id,
    NULL,
    NULL,
    'client',
    NULL,
    'cliente.completar_cadastro',
    'clients',
    v_client_id,
    NULL,
    jsonb_build_object(
      'completed_by_client', true,
      'client_id', v_client_id,
      'client_name', trim(p_name),
      'client_cpf', CASE WHEN p_cpf IS NOT NULL AND trim(regexp_replace(p_cpf, '[^0-9]', '', 'g')) ~ '^\d{11}$' THEN trim(regexp_replace(p_cpf, '[^0-9]', '', 'g')) ELSE NULL END,
      'consent_terms_accepted', p_consent_terms_accepted,
      'consent_image_use', COALESCE(p_consent_image_use, false)
    )
  );

  RETURN v_client_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.client_complete_registration(
  text, text, text, text, date, text, text, text, boolean, boolean, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_complete_registration(
  text, text, text, text, date, text, text, text, boolean, boolean, text
) TO anon, authenticated;

-- ========== 5. 20260923050000_p0_portal_agendamento.sql ==========
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

DROP FUNCTION IF EXISTS public.list_portal_busy_hours(text, date);

CREATE FUNCTION public.list_portal_busy_hours(p_token text, p_data date)
RETURNS TABLE (hora time, duration_minutes int)
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
  SELECT a.hora, coalesce(a.duration_minutes, 60)
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

  SELECT p.name, coalesce(p.duration_minutes, 60) INTO v_name, v_dur
  FROM public.procedures p
  WHERE p.id = p_procedure_id AND p.org_id = v_org AND coalesce(p.active, true) = true;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Procedimento inválido';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.agenda a
    WHERE a.org_id = v_org
      AND a.data = p_data
      AND a.cancelled_at IS NULL
      AND a.hora IS NOT NULL
      AND a.hora < (p_hora + make_interval(mins => v_dur))
      AND (a.hora + make_interval(mins => coalesce(a.duration_minutes, 60))) > p_hora
  ) THEN
    RAISE EXCEPTION 'Horário indisponível. Escolha outro.';
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
  v_dur int;
BEGIN
  SELECT s.client_id, s.org_id INTO v_client, v_org
  FROM get_client_session_by_token(p_token) AS s LIMIT 1;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  IF p_data < current_date THEN
    RAISE EXCEPTION 'Não é possível remarcar para o passado';
  END IF;

  SELECT coalesce(duration_minutes, 60) INTO v_dur
  FROM public.agenda
  WHERE id = p_agenda_id AND org_id = v_org AND cliente_id = v_client AND cancelled_at IS NULL;
  IF v_dur IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado ou já passou';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.agenda a
    WHERE a.org_id = v_org
      AND a.data = p_data
      AND a.cancelled_at IS NULL
      AND a.hora IS NOT NULL
      AND a.id <> p_agenda_id
      AND a.hora < (p_hora + make_interval(mins => v_dur))
      AND (a.hora + make_interval(mins => coalesce(a.duration_minutes, 60))) > p_hora
  ) THEN
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

REVOKE ALL ON FUNCTION public.list_portal_procedures(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_portal_busy_hours(text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_portal_appointments(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_portal_appointment(text, date, time, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reschedule_portal_appointment(text, uuid, date, time) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_portal_appointment(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_portal_procedures(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_portal_busy_hours(text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_portal_appointments(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_portal_appointment(text, date, time, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_portal_appointment(text, uuid, date, time) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_portal_appointment(text, uuid) TO anon, authenticated;

-- ========== 6. 20260923060000_p1_confirm_agenda.sql ==========
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
