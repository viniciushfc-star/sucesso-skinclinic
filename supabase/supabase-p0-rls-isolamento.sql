-- ============================================================
-- P0 isolamento: self-join em organization_users + RLS financeiro
-- NÃO apaga dados. DROP POLICY IF EXISTS + CREATE.
-- Rode no SQL Editor do Supabase.
-- ============================================================

-- 1) Convite: o convidado precisa LER o próprio convite pendente
--    (senão o EXISTS na policy de membership não enxerga a linha).
DROP POLICY IF EXISTS "invitee can read own pending invite" ON public.organization_invites;
CREATE POLICY "invitee can read own pending invite"
  ON public.organization_invites
  FOR SELECT
  TO authenticated
  USING (
    status = 'pending'
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "invitee can accept own invite" ON public.organization_invites;
CREATE POLICY "invitee can accept own invite"
  ON public.organization_invites
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    status = 'accepted'
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- 2) INSERT em organization_users: só dono da org OU convite pendente com a mesma role
DROP POLICY IF EXISTS "User can create own organization membership" ON public.organization_users;
DROP POLICY IF EXISTS "user can create own org membership" ON public.organization_users;
DROP POLICY IF EXISTS "membership insert owner or invitee" ON public.organization_users;

CREATE POLICY "membership insert owner or invitee"
  ON public.organization_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (
        EXISTS (
          SELECT 1 FROM public.organizations o
          WHERE o.id = organization_users.org_id
            AND o.owner_id = auth.uid()
        )
        AND role IN ('master', 'gestor')
      )
      OR EXISTS (
        SELECT 1 FROM public.organization_invites i
        WHERE i.org_id = organization_users.org_id
          AND i.status = 'pending'
          AND lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          AND i.role = organization_users.role
      )
    )
  );

-- 3) financeiro: isolamento por org (produção pode já ter RLS; este script é idempotente)
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org financeiro" ON public.financeiro;
CREATE POLICY "org financeiro"
  ON public.financeiro
  FOR ALL
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- 4) idempotência de webhook (opcional; insert ignora duplicata se unique bater)
ALTER TABLE public.financeiro ADD COLUMN IF NOT EXISTS webhook_event_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_org_webhook_event
  ON public.financeiro (org_id, webhook_event_id)
  WHERE webhook_event_id IS NOT NULL;
