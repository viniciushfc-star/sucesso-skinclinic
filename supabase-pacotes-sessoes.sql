-- ============================================================
-- Pacotes de sessões (venda de N sessões ao cliente; baixa por atendimento).
-- Usado por: pacotes.service.js, perfil do cliente (aba Pacotes), dar baixa na agenda.
-- Rode após ter: organizations, organization_users, procedures.
-- Cliente: tabela "clients" ou "clientes" (ajuste a REFERENCE se necessário).
-- ============================================================

-- 1) Pacotes vendidos ao cliente (N sessões de um procedimento ou nome livre)
CREATE TABLE IF NOT EXISTS public.client_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  client_id uuid NOT NULL,
  procedure_id uuid NULL,
  nome_pacote text NOT NULL DEFAULT 'Pacote de sessões',
  total_sessoes int NOT NULL DEFAULT 1 CHECK (total_sessoes >= 1),
  sessoes_utilizadas int NOT NULL DEFAULT 0 CHECK (sessoes_utilizadas >= 0),
  valor_pago numeric(12,2) NULL,
  valido_ate date NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Opcional: adicione FK para client_id se sua tabela de clientes se chama "clients" ou "clientes":
-- ALTER TABLE public.client_packages ADD CONSTRAINT fk_client_packages_client
--   FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.client_packages DROP CONSTRAINT IF EXISTS fk_client_packages_org;
ALTER TABLE public.client_packages ADD CONSTRAINT fk_client_packages_org
  FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_client_packages_org ON public.client_packages(org_id);
CREATE INDEX IF NOT EXISTS idx_client_packages_client ON public.client_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_client_packages_valido ON public.client_packages(valido_ate);

ALTER TABLE public.client_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org client_packages" ON public.client_packages;
CREATE POLICY "org client_packages" ON public.client_packages
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

COMMENT ON TABLE public.client_packages IS 'Pacotes de sessões vendidos ao cliente. Dar baixa em cada atendimento (agenda ou manual).';


-- 2) Histórico de consumo (opcional: vincular sessão ao agendamento)
CREATE TABLE IF NOT EXISTS public.package_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.client_packages(id) ON DELETE CASCADE,
  agenda_id uuid NULL,
  consumed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_package_consumptions_package ON public.package_consumptions(package_id);
CREATE INDEX IF NOT EXISTS idx_package_consumptions_agenda ON public.package_consumptions(agenda_id);

ALTER TABLE public.package_consumptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org package_consumptions" ON public.package_consumptions;
CREATE POLICY "org package_consumptions" ON public.package_consumptions
  FOR ALL TO authenticated
  USING (
    package_id IN (SELECT id FROM public.client_packages WHERE org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  )
  WITH CHECK (
    package_id IN (SELECT id FROM public.client_packages WHERE org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  );

COMMENT ON TABLE public.package_consumptions IS 'Registro de cada sessão consumida do pacote; agenda_id opcional para vincular ao atendimento.';
