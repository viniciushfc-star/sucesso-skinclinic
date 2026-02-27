-- Margem alvo e comissão: para amarrar custo (produto + profissional) e mostrar procedimentos abaixo da meta.
-- IA poderá usar esses dados + mercado para sugerir subir preço, baixar margem ou reduzir custo.

-- Org: margem alvo padrão (%) e comissão profissional padrão (% sobre valor cobrado)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'margem_alvo_padrao_pct') THEN
    ALTER TABLE public.organizations ADD COLUMN margem_alvo_padrao_pct numeric(5,2) DEFAULT 40;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'comissao_profissional_padrao_pct') THEN
    ALTER TABLE public.organizations ADD COLUMN comissao_profissional_padrao_pct numeric(5,2) DEFAULT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.organizations.margem_alvo_padrao_pct IS 'Margem alvo padrão (%). Procedimentos sem margem_minima_desejada usam este valor para comparar com margem real.';
COMMENT ON COLUMN public.organizations.comissao_profissional_padrao_pct IS 'Comissão do profissional sobre o valor cobrado (%). Usado para custo total = material + valor*comissao.';

-- Procedimento: comissão profissional (override por procedimento; se nulo, usa a da org)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'procedures' AND column_name = 'comissao_profissional_pct') THEN
    ALTER TABLE public.procedures ADD COLUMN comissao_profissional_pct numeric(5,2) DEFAULT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.procedures.comissao_profissional_pct IS 'Comissão do profissional neste procedimento (%). Se nulo, usa comissao_profissional_padrao_pct da organização.';
