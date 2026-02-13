-- ============================================================
-- ANÁLISE DE PELE POR IA (MVP) — pré-anamnese visual
-- Portal do cliente envia imagens + respostas; IA gera preliminar; clínica valida; incorpora à Anamnese (Pele).
--
-- ORDEM DE EXECUÇÃO (rode nesta ordem para evitar erros de coluna/FK):
--   1) supabase-fix-client-sessions-column.sql
--   2) supabase-client-registration-portal.sql (se ainda não rodou)
--   3) supabase-anamnese-canon.sql  ← obrigatório: cria anamnesis_registros (FK usada aqui)
--   4) supabase-anamnese-ficha-fotos.sql (opcional)
--   5) este script (supabase-analise-pele-ia.sql)
--
-- Se der "column client_id does not exist": rode 1 e 2 antes.
-- Se der "column consentimento_imagens does not exist": a tabela analise_pele já existia
--   e o bloco de migração falhou (ex.: anamnesis_registros não existia). Rode 3 e depois
--   este script de novo, ou use supabase-analise-pele-add-columns.sql para só adicionar colunas.
-- ============================================================

-- 1) client_sessions: garantir coluna client_id (get_client_session_by_token usa client_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_sessions' AND column_name = 'cliente_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_sessions' AND column_name = 'client_id') THEN
    ALTER TABLE public.client_sessions RENAME COLUMN cliente_id TO client_id;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.analise_pele (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  -- Consentimento e menores (melhorias do canon)
  consentimento_imagens boolean NOT NULL DEFAULT false,
  menor_responsavel text,
  -- Entrada: imagens (URLs após upload) e respostas do cliente
  imagens jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(imagens) = 'array'),
  respostas jsonb NOT NULL DEFAULT '{}',
  -- Análise preliminar da IA (texto; linguagem "pode estar relacionado a...")
  ia_preliminar text,
  -- Fluxo: pendente → validada → incorporada à anamnese
  status text NOT NULL DEFAULT 'pending_validation' CHECK (status IN ('pending_validation', 'validated', 'incorporated')),
  validado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  validado_em timestamptz,
  texto_validado text,
  anamnesis_registro_id uuid REFERENCES public.anamnesis_registros(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) analise_pele: se a tabela já existir com cliente_id, renomear para client_id (índices e FK usam client_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'analise_pele') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'cliente_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'client_id') THEN
      ALTER TABLE public.analise_pele RENAME COLUMN cliente_id TO client_id;
    END IF;
  END IF;
END $$;

-- 3) analise_pele: adicionar colunas que faltam (quando a tabela já existia com estrutura antiga)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'consentimento_imagens') THEN
    ALTER TABLE public.analise_pele ADD COLUMN consentimento_imagens boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'menor_responsavel') THEN
    ALTER TABLE public.analise_pele ADD COLUMN menor_responsavel text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'imagens') THEN
    ALTER TABLE public.analise_pele ADD COLUMN imagens jsonb NOT NULL DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'respostas') THEN
    ALTER TABLE public.analise_pele ADD COLUMN respostas jsonb NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'ia_preliminar') THEN
    ALTER TABLE public.analise_pele ADD COLUMN ia_preliminar text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'status') THEN
    ALTER TABLE public.analise_pele ADD COLUMN status text NOT NULL DEFAULT 'pending_validation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'validado_por') THEN
    ALTER TABLE public.analise_pele ADD COLUMN validado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'validado_em') THEN
    ALTER TABLE public.analise_pele ADD COLUMN validado_em timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'texto_validado') THEN
    ALTER TABLE public.analise_pele ADD COLUMN texto_validado text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'anamnesis_registro_id') THEN
    ALTER TABLE public.analise_pele ADD COLUMN anamnesis_registro_id uuid REFERENCES public.anamnesis_registros(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analise_pele' AND column_name = 'created_at') THEN
    ALTER TABLE public.analise_pele ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_analise_pele_org ON public.analise_pele(org_id);
CREATE INDEX IF NOT EXISTS idx_analise_pele_client ON public.analise_pele(client_id);
CREATE INDEX IF NOT EXISTS idx_analise_pele_status ON public.analise_pele(org_id, status);
CREATE INDEX IF NOT EXISTS idx_analise_pele_created ON public.analise_pele(org_id, created_at DESC);

-- FK de analise_pele.client_id para clients ou clientes (conforme existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'analise_pele' AND constraint_name = 'fk_analise_pele_client') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
      ALTER TABLE public.analise_pele ADD CONSTRAINT fk_analise_pele_client FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clientes') THEN
      ALTER TABLE public.analise_pele ADD CONSTRAINT fk_analise_pele_client FOREIGN KEY (client_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

COMMENT ON TABLE public.analise_pele IS 'Pré-anamnese visual por IA. Cliente envia fotos e respostas; IA gera preliminar; clínica valida; só após validação vira registro na Anamnese (Pele).';
COMMENT ON COLUMN public.analise_pele.consentimento_imagens IS 'Cliente autorizou uso das imagens apenas para análise e validação pela clínica.';
COMMENT ON COLUMN public.analise_pele.menor_responsavel IS 'Nome do responsável legal, se o cliente for menor.';
COMMENT ON COLUMN public.analise_pele.ia_preliminar IS 'Texto da análise preliminar da IA. Linguagem obrigatória: pode estar relacionado a..., vale investigar com profissional.';
COMMENT ON COLUMN public.analise_pele.texto_validado IS 'Texto final após validação/correção do profissional.';
COMMENT ON COLUMN public.analise_pele.anamnesis_registro_id IS 'Registro na Anamnese (função Pele) criado ao incorporar esta análise.';

-- RLS: membros da org podem ler/atualizar; inserção via RPC com token do cliente (portal)
ALTER TABLE public.analise_pele ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members analise_pele" ON public.analise_pele;
CREATE POLICY "org members analise_pele"
  ON public.analise_pele
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- Inserção pelo portal: RPC que valida token do cliente e insere com client_id/org_id da sessão
CREATE OR REPLACE FUNCTION public.submit_analise_pele(
  p_token text,
  p_consentimento_imagens boolean,
  p_menor_responsavel text,
  p_imagens jsonb,
  p_respostas jsonb,
  p_ia_preliminar text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_id uuid;
BEGIN
  SELECT client_id, org_id INTO v_session
  FROM get_client_session_by_token(p_token) AS s(client_id uuid, org_id uuid, expires_at timestamptz, registration_completed_at timestamptz);
  IF v_session.client_id IS NULL OR v_session.org_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  IF NOT p_consentimento_imagens THEN
    RAISE EXCEPTION 'É necessário autorizar o uso das imagens para análise';
  END IF;
  INSERT INTO public.analise_pele (org_id, client_id, consentimento_imagens, menor_responsavel, imagens, respostas, ia_preliminar)
  VALUES (v_session.org_id, v_session.client_id, p_consentimento_imagens, NULLIF(trim(p_menor_responsavel), ''), COALESCE(p_imagens, '[]'), COALESCE(p_respostas, '{}'), p_ia_preliminar)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'org_id', v_session.org_id, 'client_id', v_session.client_id);
END;
$$;

COMMENT ON FUNCTION public.submit_analise_pele IS 'Portal: cliente submete análise de pele (após consentimento). Valida token e insere com client_id/org_id da sessão.';

-- Cliente lê suas próprias análises (por token)
CREATE OR REPLACE FUNCTION public.get_analises_pele_by_token(p_token text)
RETURNS SETOF public.analise_pele
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_org_id uuid;
BEGIN
  SELECT s.client_id, s.org_id INTO v_client_id, v_org_id
  FROM get_client_session_by_token(p_token) AS s(client_id uuid, org_id uuid, expires_at timestamptz, registration_completed_at timestamptz)
  LIMIT 1;
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  RETURN QUERY
  SELECT a.* FROM public.analise_pele a
  WHERE a.client_id = v_client_id AND a.org_id = v_org_id
  ORDER BY a.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_analises_pele_by_token IS 'Portal: cliente lista suas análises de pele (por token).';

-- Storage: criar bucket "analise-pele-fotos" no Supabase Dashboard > Storage (público ou com RLS por org).
-- Política sugerida: membros da org podem ler; inserção via API com service key ou RLS por org_id no path.
