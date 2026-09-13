-- Adiciona colunas para "gestor deu ok" na auditoria.
-- Master continua vendo tudo; gestor pode dar ok; itens com ok não precisam ficar nas "pendências" do master.

-- Colunas opcionais (se a tabela audit_logs já existir)
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by_email text;

COMMENT ON COLUMN audit_logs.acknowledged_by IS 'Usuário (gestor) que deu ok neste item de auditoria';
COMMENT ON COLUMN audit_logs.acknowledged_at IS 'Data/hora em que o gestor deu ok';
COMMENT ON COLUMN audit_logs.acknowledged_by_email IS 'E-mail de quem deu ok (para exibição sem join)';

-- Política: apenas gestor ou master da mesma organização podem atualizar (ex.: dar ok)
-- No app enviamos apenas acknowledged_by, acknowledged_at, acknowledged_by_email.
DROP POLICY IF EXISTS "audit_logs_update_acknowledge" ON audit_logs;
CREATE POLICY "audit_logs_update_acknowledge"
  ON audit_logs
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM organization_users
      WHERE user_id = auth.uid()
      AND role IN ('master', 'gestor')
    )
  )
  WITH CHECK (true);
