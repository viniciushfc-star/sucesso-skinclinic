-- Portfólio de produtos (sem quantidade) + frete na entrada.
-- Cole no SQL Editor e Run.

CREATE TABLE IF NOT EXISTS public.estoque_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  custo_pago decimal(12,4),
  preco_profissional decimal(12,4),
  preco_cliente decimal(12,4),
  frete_padrao decimal(12,4),
  validade_referencia date,
  unidade text,
  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_estoque_produtos_org_nome
  ON public.estoque_produtos (org_id, lower(nome));

CREATE INDEX IF NOT EXISTS idx_estoque_produtos_org
  ON public.estoque_produtos (org_id);

ALTER TABLE public.estoque_produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members estoque produtos" ON public.estoque_produtos;
CREATE POLICY "org members estoque produtos"
  ON public.estoque_produtos
  FOR ALL
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estoque_entradas' AND column_name = 'valor_frete'
  ) THEN
    ALTER TABLE public.estoque_entradas ADD COLUMN valor_frete decimal(12,4);
  END IF;
END $$;

COMMENT ON TABLE public.estoque_produtos IS 'Portfólio: cadastro sem estoque. Quantidade só na entrada.';
COMMENT ON COLUMN public.estoque_produtos.custo_pago IS 'O que a clínica paga por unidade.';
COMMENT ON COLUMN public.estoque_produtos.preco_profissional IS 'Valor de revenda para a profissional.';
COMMENT ON COLUMN public.estoque_produtos.preco_cliente IS 'Valor para o cliente final.';
COMMENT ON COLUMN public.estoque_produtos.frete_padrao IS 'Frete típico por unidade (investimento).';
COMMENT ON COLUMN public.estoque_entradas.valor_frete IS 'Frete desta compra (total). Entra no custo investido.';
