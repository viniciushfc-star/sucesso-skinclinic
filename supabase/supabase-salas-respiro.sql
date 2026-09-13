-- ============================================================
-- SALAS/CABINES E CONFIGURAÇÃO DE RESPIRO
-- Organiza o espaço físico e garante intervalos saudáveis
-- ============================================================

-- 1) Tabela de salas/cabines por organização
CREATE TABLE IF NOT EXISTS public.salas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salas_org_ativa ON public.salas(org_id) WHERE ativa = true;

COMMENT ON TABLE public.salas IS 'Salas/cabines físicas da clínica por organização.';

-- 2) Configurações de agenda por organização (respiro, etc.)
CREATE TABLE IF NOT EXISTS public.agenda_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Tempo de respiro entre sessões (minutos)
  respiro_sala_minutos int NOT NULL DEFAULT 10,
  respiro_profissional_minutos int NOT NULL DEFAULT 5,
  -- Exigir sala em procedimentos?
  sala_obrigatoria boolean NOT NULL DEFAULT true,
  -- Exigir profissional em procedimentos?
  profissional_obrigatorio boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agenda_config IS 'Configurações de agenda por organização: respiro, obrigatoriedades.';
COMMENT ON COLUMN public.agenda_config.respiro_sala_minutos IS 'Minutos de intervalo entre sessões na mesma sala (organização, limpeza).';
COMMENT ON COLUMN public.agenda_config.respiro_profissional_minutos IS 'Minutos de intervalo entre sessões do mesmo profissional (descanso).';

-- 3) Evoluir tabela agenda: adicionar referência à sala (se ainda não existir)
DO $migrate$
BEGIN
  -- Coluna sala_id referenciando tabela salas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'sala_id'
  ) THEN
    ALTER TABLE public.agenda
      ADD COLUMN sala_id uuid REFERENCES public.salas(id) ON DELETE SET NULL;
  END IF;
END $migrate$;

COMMENT ON COLUMN public.agenda.sala_id IS 'Sala/cabine onde o procedimento será realizado.';

-- 4) Criar tabela afazeres (se não existir) OU adicionar coluna tipo (se existir sem ela)
-- Afazeres: tarefas que não ocupam sala (atendimento remoto, conferência estoque, etc.)
CREATE TABLE IF NOT EXISTS public.afazeres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  responsavel_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  prazo date,
  tipo text NOT NULL DEFAULT 'geral' CHECK (tipo IN ('geral', 'atendimento_remoto', 'conferencia_estoque', 'administrativa', 'skincare_remoto', 'outro')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_afazeres_org ON public.afazeres(org_id);
CREATE INDEX IF NOT EXISTS idx_afazeres_responsavel ON public.afazeres(org_id, responsavel_user_id);
CREATE INDEX IF NOT EXISTS idx_afazeres_prazo ON public.afazeres(org_id, prazo);
COMMENT ON TABLE public.afazeres IS 'Tarefas com responsável e prazo; não ocupam agenda de atendimento.';

-- Se a tabela já existia mas sem a coluna tipo, adiciona
DO $migrate_afazeres$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'afazeres' AND column_name = 'tipo'
  ) THEN
    ALTER TABLE public.afazeres
      ADD COLUMN tipo text NOT NULL DEFAULT 'geral'
        CHECK (tipo IN ('geral', 'atendimento_remoto', 'conferencia_estoque', 'administrativa', 'skincare_remoto', 'outro'));
  END IF;
END $migrate_afazeres$;

ALTER TABLE public.afazeres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members afazeres" ON public.afazeres;
CREATE POLICY "org members afazeres" ON public.afazeres FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS tr_afazeres_updated ON public.afazeres;
CREATE TRIGGER tr_afazeres_updated BEFORE UPDATE ON public.afazeres
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

COMMENT ON COLUMN public.afazeres.tipo IS 'Tipo da tarefa: geral, atendimento_remoto, conferencia_estoque, etc.';

-- 5) RLS: salas
ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can manage salas" ON public.salas;
CREATE POLICY "org members can manage salas" ON public.salas
  FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- 6) RLS: agenda_config
ALTER TABLE public.agenda_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can manage agenda_config" ON public.agenda_config;
CREATE POLICY "org members can manage agenda_config" ON public.agenda_config
  FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- 7) Triggers para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_salas_updated_at ON public.salas;
CREATE TRIGGER trg_salas_updated_at
  BEFORE UPDATE ON public.salas
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_agenda_config_updated_at ON public.agenda_config;
CREATE TRIGGER trg_agenda_config_updated_at
  BEFORE UPDATE ON public.agenda_config
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- 8) Inserir configuração padrão se não existir (exemplo para orgs existentes)
-- (Opcional: rodar manualmente ou via seed)
-- INSERT INTO public.agenda_config (org_id)
-- SELECT id FROM public.organizations
-- WHERE NOT EXISTS (SELECT 1 FROM public.agenda_config WHERE org_id = organizations.id);
