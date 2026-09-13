-- Registro de protocolo mais usual: o que foi feito, produtos usados (estoque), descrição.
-- Ligado ao prontuário do paciente e à data do atendimento.

-- 1) Novas colunas em protocolos_aplicados
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'protocolos_aplicados' AND column_name = 'descricao') THEN
    ALTER TABLE public.protocolos_aplicados ADD COLUMN descricao text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'protocolos_aplicados' AND column_name = 'produtos_usados') THEN
    ALTER TABLE public.protocolos_aplicados ADD COLUMN produtos_usados jsonb DEFAULT '[]';
  END IF;
END $$;

COMMENT ON COLUMN public.protocolos_aplicados.descricao IS 'O que foi feito no atendimento (texto livre).';
COMMENT ON COLUMN public.protocolos_aplicados.produtos_usados IS 'Produtos do estoque utilizados: [{ "produto_nome": "...", "quantidade": 1 }].';

-- 2) protocolo_id opcional: permite registrar só "o que foi feito" + produtos sem protocolo cadastrado
DO $$
BEGIN
  ALTER TABLE public.protocolos_aplicados ALTER COLUMN protocolo_id DROP NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- já nullable
END $$;

-- 3) estoque_consumo: garantir coluna protocolo_aplicado_id (pode já existir pelo protocolo-canon)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'estoque_consumo' AND column_name = 'protocolo_aplicado_id') THEN
    ALTER TABLE public.estoque_consumo ADD COLUMN protocolo_aplicado_id uuid REFERENCES public.protocolos_aplicados(id) ON DELETE SET NULL;
  END IF;
END $$;
