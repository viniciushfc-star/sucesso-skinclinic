-- ============================================================
-- RLS DEFINITIVO – onboarding e dashboard
-- Execute no Supabase: SQL Editor → New query → Cole e Run
-- ============================================================
-- Schema: organizations (id, name, owner_id, settings, created_at)
--         organization_users (id, org_id, user_id, role, created_at)

-- 1️⃣ GARANTIR RLS ATIVO
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;

-- 2️⃣ POLICY: USUÁRIO AUTENTICADO PODE CRIAR ORGANIZAÇÃO (owner_id = auth.uid())
--    Resolve 100% o erro do botão "Criar clínica" (403 / violates row-level security)
DROP POLICY IF EXISTS "authenticated can create organization" ON organizations;
CREATE POLICY "authenticated can create organization"
ON organizations
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- 3️⃣ POLICY: DONO PODE VER SUA ORGANIZAÇÃO (por owner_id)
DROP POLICY IF EXISTS "owner can read own organization" ON organizations;
CREATE POLICY "owner can read own organization"
ON organizations
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- 4️⃣ POLICY: USUÁRIO PODE VER ORGANIZAÇÕES QUE PERTENCE (por organization_users)
--    Quem libera entrada na org é o master/convidante; esta policy é só para LEITURA.
DROP POLICY IF EXISTS "user can read organizations they belong to" ON organizations;
CREATE POLICY "user can read organizations they belong to"
ON organizations
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT org_id
    FROM organization_users
    WHERE user_id = auth.uid()
  )
);

-- 5️⃣ POLICY: USUÁRIO PODE CRIAR SEU PRÓPRIO VÍNCULO (só user_id = auth.uid())
--    Necessária para: (a) onboarding – criador se vincula como master;
--                     (b) aceitar convite – usuário se vincula com role do convite.
--    Quem “libera” quem entra na org é o master (convite); o insert é sempre do próprio usuário.
DROP POLICY IF EXISTS "user can create own org membership" ON organization_users;
CREATE POLICY "user can create own org membership"
ON organization_users
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 6️⃣ POLICY: USUÁRIO PODE VER SEUS VÍNCULOS (loadUserOrganizations, permissões)
DROP POLICY IF EXISTS "user can read own organization memberships" ON organization_users;
CREATE POLICY "user can read own organization memberships"
ON organization_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
