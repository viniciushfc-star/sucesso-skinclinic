-- Fase 0: aplicar protocolo baixa estoque_consumo (estimado).
-- Trigger SECURITY DEFINER só escreve na org do NEW.org_id. Cliente autentica com JWT.
-- Reaplicável. Não reabre isolamento.

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

CREATE TABLE IF NOT EXISTS public.protocolos_descartaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id uuid NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  produto_nome text NOT NULL,
  quantidade decimal(12,4) NOT NULL DEFAULT 1,
  UNIQUE(protocolo_id, produto_nome)
);

CREATE TABLE IF NOT EXISTS public.protocolos_aplicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  protocolo_id uuid REFERENCES public.protocolos(id) ON DELETE RESTRICT,
  agenda_id uuid,
  aplicado_em timestamptz NOT NULL DEFAULT now(),
  observacao text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'protocolos_aplicados' AND column_name = 'descricao'
  ) THEN
    ALTER TABLE public.protocolos_aplicados ADD COLUMN descricao text DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'protocolos_aplicados' AND column_name = 'produtos_usados'
  ) THEN
    ALTER TABLE public.protocolos_aplicados ADD COLUMN produtos_usados jsonb DEFAULT '[]'::jsonb;
  END IF;
  BEGIN
    ALTER TABLE public.protocolos_aplicados ALTER COLUMN protocolo_id DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

CREATE TABLE IF NOT EXISTS public.estoque_consumo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  produto_nome text NOT NULL,
  quantidade decimal(12,4) NOT NULL DEFAULT 0,
  procedure_id uuid,
  agenda_id uuid,
  tipo text NOT NULL DEFAULT 'estimado',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estoque_consumo' AND column_name = 'protocolo_aplicado_id'
  ) THEN
    ALTER TABLE public.estoque_consumo
      ADD COLUMN protocolo_aplicado_id uuid REFERENCES public.protocolos_aplicados(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estoque_consumo' AND column_name = 'lote'
  ) THEN
    ALTER TABLE public.estoque_consumo ADD COLUMN lote text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estoque_consumo' AND column_name = 'motivo'
  ) THEN
    ALTER TABLE public.estoque_consumo ADD COLUMN motivo text;
  END IF;
END $$;

ALTER TABLE public.estoque_consumo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org members estoque consumo" ON public.estoque_consumo;
CREATE POLICY "org members estoque consumo"
  ON public.estoque_consumo
  FOR ALL
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.estoque_consumo_ao_aplicar_protocolo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.protocolo_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.estoque_consumo (org_id, produto_nome, quantidade, tipo, protocolo_aplicado_id, created_by)
  SELECT NEW.org_id, d.produto_nome, d.quantidade, 'estimado', NEW.id, NEW.created_by
  FROM public.protocolos_descartaveis d
  WHERE d.protocolo_id = NEW.protocolo_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.estoque_consumo c
      WHERE c.protocolo_aplicado_id = NEW.id
        AND lower(btrim(c.produto_nome)) = lower(btrim(d.produto_nome))
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_estoque_consumo_ao_aplicar_protocolo ON public.protocolos_aplicados;
CREATE TRIGGER trg_estoque_consumo_ao_aplicar_protocolo
  AFTER INSERT ON public.protocolos_aplicados
  FOR EACH ROW
  EXECUTE PROCEDURE public.estoque_consumo_ao_aplicar_protocolo();
