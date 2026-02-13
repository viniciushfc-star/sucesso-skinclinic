-- ============================================================
-- PROTOCOLO CANÔNICO — o que é feito dentro do procedimento + registro do que foi aplicado
-- Alinha com PROTOCOLO-IDEIA-AMADURECIDA.md e protocolo-canon.mdc.
-- Estoque vê pelo protocolo o que foi usado; assume descartáveis ao aplicar.
-- ============================================================

-- 1) Cadastro de protocolos (template: o que é feito dentro do procedimento)
CREATE TABLE IF NOT EXISTS public.protocolos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao_passos text DEFAULT '',
  observacoes text DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_protocolos_org ON public.protocolos(org_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_org_active ON public.protocolos(org_id) WHERE active = true;
COMMENT ON TABLE public.protocolos IS 'Template: o que é feito dentro do procedimento. Proteção da empresa + base para estoque assumir descartáveis.';

-- 2) Descartáveis por protocolo (estoque assume consumo quando protocolo for aplicado)
CREATE TABLE IF NOT EXISTS public.protocolos_descartaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id uuid NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  produto_nome text NOT NULL,
  quantidade decimal(12,4) NOT NULL DEFAULT 1,
  UNIQUE(protocolo_id, produto_nome)
);

CREATE INDEX IF NOT EXISTS idx_protocolos_descartaveis_protocolo ON public.protocolos_descartaveis(protocolo_id);
COMMENT ON TABLE public.protocolos_descartaveis IS 'O que cada protocolo usa de descartáveis; estoque assume consumo ao registrar protocolo aplicado.';

-- 3) Registro: protocolo aplicado (por cliente, opcionalmente por atendimento/agenda)
CREATE TABLE IF NOT EXISTS public.protocolos_aplicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  protocolo_id uuid NOT NULL REFERENCES public.protocolos(id) ON DELETE RESTRICT,
  agenda_id uuid,
  aplicado_em timestamptz NOT NULL DEFAULT now(),
  observacao text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_protocolos_aplicados_org ON public.protocolos_aplicados(org_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_aplicados_client ON public.protocolos_aplicados(client_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_aplicados_aplicado_em ON public.protocolos_aplicados(org_id, aplicado_em DESC);
CREATE INDEX IF NOT EXISTS idx_protocolos_aplicados_agenda ON public.protocolos_aplicados(agenda_id) WHERE agenda_id IS NOT NULL;

-- FK client_id → clients (ou clientes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'protocolos_aplicados' AND constraint_name = 'fk_protocolos_aplicados_client') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
      ALTER TABLE public.protocolos_aplicados ADD CONSTRAINT fk_protocolos_aplicados_client FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clientes') THEN
      ALTER TABLE public.protocolos_aplicados ADD CONSTRAINT fk_protocolos_aplicados_client FOREIGN KEY (client_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

COMMENT ON TABLE public.protocolos_aplicados IS 'Registro do que foi aplicado no paciente (proteção da empresa). Opcional: agenda_id para cruzar com atendimento.';

-- 4) estoque_consumo: coluna opcional para vincular consumo ao protocolo aplicado
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'estoque_consumo' AND column_name = 'protocolo_aplicado_id') THEN
    ALTER TABLE public.estoque_consumo ADD COLUMN protocolo_aplicado_id uuid REFERENCES public.protocolos_aplicados(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_estoque_consumo_protocolo_aplicado ON public.estoque_consumo(protocolo_aplicado_id) WHERE protocolo_aplicado_id IS NOT NULL;

-- 5) RLS
ALTER TABLE public.protocolos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org members protocolos" ON public.protocolos;
CREATE POLICY "org members protocolos" ON public.protocolos
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

ALTER TABLE public.protocolos_descartaveis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org members protocolos descartaveis" ON public.protocolos_descartaveis;
CREATE POLICY "org members protocolos descartaveis" ON public.protocolos_descartaveis
  FOR ALL TO authenticated
  USING (protocolo_id IN (SELECT id FROM public.protocolos WHERE org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())))
  WITH CHECK (protocolo_id IN (SELECT id FROM public.protocolos WHERE org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid())));

ALTER TABLE public.protocolos_aplicados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org members protocolos aplicados" ON public.protocolos_aplicados;
CREATE POLICY "org members protocolos aplicados" ON public.protocolos_aplicados
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- 6) Função: ao inserir protocolo_aplicado, inserir consumo estimado dos descartáveis (para estoque)
CREATE OR REPLACE FUNCTION public.estoque_consumo_ao_aplicar_protocolo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.estoque_consumo (org_id, produto_nome, quantidade, tipo, protocolo_aplicado_id, created_by)
  SELECT NEW.org_id, d.produto_nome, d.quantidade, 'estimado', NEW.id, NEW.created_by
  FROM public.protocolos_descartaveis d
  WHERE d.protocolo_id = NEW.protocolo_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_estoque_consumo_ao_aplicar_protocolo ON public.protocolos_aplicados;
CREATE TRIGGER trg_estoque_consumo_ao_aplicar_protocolo
  AFTER INSERT ON public.protocolos_aplicados
  FOR EACH ROW
  EXECUTE PROCEDURE public.estoque_consumo_ao_aplicar_protocolo();

COMMENT ON FUNCTION public.estoque_consumo_ao_aplicar_protocolo IS 'Ao registrar protocolo aplicado, assume consumo dos descartáveis cadastrados no protocolo (estoque).';
