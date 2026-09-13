-- ============================================================
-- Remove TODAS as politicas da tabela clients e cria as corretas
-- (resolve se ainda existir politica com outro nome usando app.org_id)
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

-- 1) Remove TODAS as politicas da tabela clients (qualquer nome)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'clients'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.clients';
  END LOOP;
END
$$;

-- 2) Liga RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 3) Cria as 3 politicas corretas (sem app.org_id)
CREATE POLICY "Org members can read clients"
  ON public.clients FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid()));

CREATE POLICY "Org members can insert clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid()));

CREATE POLICY "Org members can update clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid()));

-- 4) Se o frontend ainda der app.org_id: crie a RPC set_config (para o front poder setar app.org_id)
-- Descomente e rode se o seu projeto ainda nao tiver essa funcao:
/*
CREATE OR REPLACE FUNCTION public.set_config(p_key text, p_value text, p_is_local boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_catalog.set_config(p_key, p_value, p_is_local);
END $$;
*/
