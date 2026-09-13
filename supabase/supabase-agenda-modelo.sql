-- ============================================================
-- MODELO AGENDA: procedure | event | profissional | catálogo
-- Aditivo: não altera dados existentes; adiciona colunas e tabelas.
-- ============================================================

-- 1) Catálogo de procedimentos válidos por organização
CREATE TABLE IF NOT EXISTS public.procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procedures_org_active ON public.procedures(org_id) WHERE active = true;

COMMENT ON TABLE public.procedures IS 'Procedimentos validos por org; usados em itens de agenda tipo procedure.';

-- 2) Evolução da tabela agenda (tipos procedure vs event)
DO $migrate$
BEGIN
  -- Tipo do item: procedure (com cliente) ou event (interno)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'item_type'
  ) THEN
    ALTER TABLE public.agenda
      ADD COLUMN item_type text NOT NULL DEFAULT 'procedure'
        CHECK (item_type IN ('procedure', 'event'));
  END IF;

  -- Quem executa (pode ser igual ao user_id que criou)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'professional_id'
  ) THEN
    ALTER TABLE public.agenda
      ADD COLUMN professional_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    -- Preencher com user_id onde existir
    UPDATE public.agenda SET professional_id = user_id WHERE user_id IS NOT NULL AND professional_id IS NULL;
  END IF;

  -- Procedimento do catálogo (opcional; procedimento em texto pode continuar)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'procedure_id'
  ) THEN
    ALTER TABLE public.agenda
      ADD COLUMN procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL;
  END IF;

  -- Duração em minutos (para fim do slot)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'duration_minutes'
  ) THEN
    ALTER TABLE public.agenda
      ADD COLUMN duration_minutes int DEFAULT 60;
  END IF;

  -- Sala/cabine (opcional)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'room_or_cabine'
  ) THEN
    ALTER TABLE public.agenda
      ADD COLUMN room_or_cabine text;
  END IF;

  -- Evento interno: título e tipo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'event_title'
  ) THEN
    ALTER TABLE public.agenda
      ADD COLUMN event_title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE public.agenda
      ADD COLUMN event_type text
        CHECK (event_type IS NULL OR event_type IN ('reuniao', 'bloqueio', 'treinamento', 'outro'));
  END IF;
END $migrate$;

COMMENT ON COLUMN public.agenda.item_type IS 'procedure = atendimento ao cliente; event = reuniao, bloqueio, treinamento.';
COMMENT ON COLUMN public.agenda.professional_id IS 'Profissional que executa o procedimento/evento.';
COMMENT ON COLUMN public.agenda.event_title IS 'Titulo do evento interno (quando item_type = event).';

-- 3) Blocos de calendário externo (ex.: Google) — só indisponível, sem detalhes
CREATE TABLE IF NOT EXISTS public.external_calendar_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_end_after_start CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_external_calendar_blocks_user_range
  ON public.external_calendar_blocks(user_id, start_at, end_at);

COMMENT ON TABLE public.external_calendar_blocks IS 'Horarios indisponiveis do profissional (ex. Google); sem titulo/descricao para privacidade.';

-- 4) RLS: procedures
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can manage procedures" ON public.procedures;
CREATE POLICY "org members can manage procedures" ON public.procedures
  FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- 5) RLS: external_calendar_blocks (cada um vê/gerencia só os próprios blocos ou da org)
ALTER TABLE public.external_calendar_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own org blocks" ON public.external_calendar_blocks;
CREATE POLICY "users see own org blocks" ON public.external_calendar_blocks
  FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- 6) Garantir que agenda já tenha RLS compatível (se não tiver, descomente e ajuste)
-- ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "org members agenda" ON public.agenda ...
