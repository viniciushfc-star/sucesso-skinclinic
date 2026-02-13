-- Avaliações de produtos pelos profissionais (para precificação e índice de cuidado).
-- Rode após supabase-estoque-canon.sql e supabase-rls-organizations.sql.

CREATE TABLE IF NOT EXISTS public.produto_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  produto_nome text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  nota smallint NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produto_avaliacoes_org ON public.produto_avaliacoes(org_id);
CREATE INDEX IF NOT EXISTS idx_produto_avaliacoes_produto ON public.produto_avaliacoes(org_id, produto_nome);
CREATE INDEX IF NOT EXISTS idx_produto_avaliacoes_user ON public.produto_avaliacoes(org_id, user_id);

COMMENT ON TABLE public.produto_avaliacoes IS 'Avaliações de produtos por profissionais (1-5 estrelas + comentário). Base para índice de cuidado e bonificação.';

ALTER TABLE public.produto_avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members produto avaliacoes" ON public.produto_avaliacoes;
CREATE POLICY "org members produto avaliacoes" ON public.produto_avaliacoes
  FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));
