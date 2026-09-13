-- ============================================================
-- RLS para onboarding: permitir criar organização e se vincular
-- Execute no Supabase: SQL Editor → New query → Cole e Run
-- ============================================================

-- 1️⃣ Garantir RLS ativo
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;

-- 2️⃣ PERMITIR INSERT EM organizations (CRIAR CLÍNICA)
-- O frontend envia: { name, owner_id: user.id }
CREATE POLICY "Authenticated user can create organization"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- 3️⃣ PERMITIR SELECT DAS ORGANIZAÇÕES DO USUÁRIO (dashboard, loadUserOrganizations)
CREATE POLICY "User can read organizations they belong to"
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

-- 4️⃣ PERMITIR INSERT EM organization_users (VÍNCULO MASTER)
CREATE POLICY "User can create own organization membership"
  ON organization_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 5️⃣ PERMITIR SELECT DO PRÓPRIO VÍNCULO
CREATE POLICY "User can read own organization memberships"
  ON organization_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Se alguma política já existir (mesmo nome), vai dar "already exists".
-- Nesse caso, no Dashboard: Table Editor → tabela → Policies,
-- desative ou apague a antiga e rode de novo, ou comente o bloco correspondente acima.
