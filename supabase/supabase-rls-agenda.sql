-- ============================================================
-- RLS para a tabela agenda (acesso por membros da organização)
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================
-- Sem isso, o SELECT/INSERT/UPDATE na agenda pode falhar por RLS
-- e a tela de agendamento não mostra os itens nem as métricas.

-- 1) Ativar RLS na tabela agenda (se ainda não existir)
ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;

-- 2) Remover TODAS as policies (nomes antigos / app.org_id). Senão o live continua a esconder a agenda.
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
END $$;

-- 3) Políticas: só usuários que pertencem à org (organization_users) veem/editam a agenda daquela org
CREATE POLICY "Org members can read agenda"
  ON public.agenda
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can insert agenda"
  ON public.agenda
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can update agenda"
  ON public.agenda
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );

-- Opcional: permitir DELETE (cancelar agendamento)
DROP POLICY IF EXISTS "Org members can delete agenda" ON public.agenda;
CREATE POLICY "Org members can delete agenda"
  ON public.agenda
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );
