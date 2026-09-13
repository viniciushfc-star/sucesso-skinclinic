-- ============================================================
-- CADASTRO DA EMPRESA (perfil da organização)
-- Referência única: marketing (região), identidade (logo), futura nota (CNPJ/endereço)
-- ============================================================

-- 1) Colunas na tabela organizations (se não existirem)
DO $migrate$
BEGIN
  -- Região de atuação (para marketing pensar na região)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'cidade') THEN
    ALTER TABLE public.organizations ADD COLUMN cidade text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'estado') THEN
    ALTER TABLE public.organizations ADD COLUMN estado text;
  END IF;
  -- Logo (identidade da empresa no app → familiaridade e aceitação)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'logo_url') THEN
    ALTER TABLE public.organizations ADD COLUMN logo_url text;
  END IF;
  -- Dados para futura emissão de nota (opcional)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'endereco') THEN
    ALTER TABLE public.organizations ADD COLUMN endereco text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'cnpj') THEN
    ALTER TABLE public.organizations ADD COLUMN cnpj text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'telefone') THEN
    ALTER TABLE public.organizations ADD COLUMN telefone text;
  END IF;
END $migrate$;

COMMENT ON COLUMN public.organizations.cidade IS 'Cidade de atuação — usado por marketing (região) e identidade.';
COMMENT ON COLUMN public.organizations.estado IS 'Estado (UF) — usado por marketing (região).';
COMMENT ON COLUMN public.organizations.logo_url IS 'URL da logo da empresa — identidade no app, maior familiaridade dos profissionais.';
COMMENT ON COLUMN public.organizations.endereco IS 'Endereço — referência para futura emissão de nota (opcional).';
COMMENT ON COLUMN public.organizations.cnpj IS 'CNPJ — referência para futura emissão de nota (opcional).';
COMMENT ON COLUMN public.organizations.telefone IS 'Telefone da empresa — referência e contato.';

-- 2) Política de UPDATE: membros da org podem atualizar o perfil (cadastro da empresa)
DROP POLICY IF EXISTS "Org members can update organization profile" ON public.organizations;
CREATE POLICY "Org members can update organization profile" ON public.organizations
  FOR UPDATE TO authenticated
  USING (id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
