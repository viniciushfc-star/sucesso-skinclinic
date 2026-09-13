-- ============================================================
-- Documentos jurídicos da organização (termos, políticas, LGPD)
-- Essencial para defesa judicial e conformidade.
-- Execute após: supabase-rls-organizations.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organization_legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  doc_key text NOT NULL,
  content text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, doc_key)
);

CREATE INDEX IF NOT EXISTS idx_org_legal_docs_org ON public.organization_legal_documents(org_id);

COMMENT ON TABLE public.organization_legal_documents IS 'Documentos jurídicos da clínica: política de privacidade, termo LGPD, política de cancelamento, contrato de prestação de serviços. Essencial para defesa judicial.';
COMMENT ON COLUMN public.organization_legal_documents.doc_key IS 'Chave: contrato_servicos, termo_consentimento_informado, autorizacao_uso_imagem, termo_pos_procedimento, termo_privacidade_lgpd, politica_cancelamento, anamnese_referencia';
COMMENT ON COLUMN public.organization_legal_documents.content IS 'Texto do documento (editável pela clínica). Null = usar modelo padrão no frontend.';

-- RLS
ALTER TABLE public.organization_legal_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_legal_docs_select" ON public.organization_legal_documents;
CREATE POLICY "org_legal_docs_select" ON public.organization_legal_documents
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "org_legal_docs_insert" ON public.organization_legal_documents;
CREATE POLICY "org_legal_docs_insert" ON public.organization_legal_documents
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "org_legal_docs_update" ON public.organization_legal_documents;
CREATE POLICY "org_legal_docs_update" ON public.organization_legal_documents
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())
  );
