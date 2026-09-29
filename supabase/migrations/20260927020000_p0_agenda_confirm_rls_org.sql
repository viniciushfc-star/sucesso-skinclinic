-- P0: agenda e confirmação — DROP de TODAS as policies (não só o nome Git).
-- Live escondia horário do master (app.org_id / policy antiga). Membership = organization_users.
-- Cole no SQL Editor se o migration ainda não rodou.
-- Portal público continua nas RPCs SECURITY DEFINER (não depende destas policies).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agenda'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.agenda', r.policyname);
  END LOOP;
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appointment_confirmations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.appointment_confirmations', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_select_org"
  ON public.agenda FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

CREATE POLICY "agenda_insert_org"
  ON public.agenda FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

CREATE POLICY "agenda_update_org"
  ON public.agenda FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

CREATE POLICY "agenda_delete_org"
  ON public.agenda FOR DELETE TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

CREATE POLICY "appointment_confirmations_org"
  ON public.appointment_confirmations FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
