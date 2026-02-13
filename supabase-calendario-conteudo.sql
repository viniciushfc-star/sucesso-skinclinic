-- ============================================================
-- CALENDÁRIO DE CONTEÚDO — fluxo de aprovação e agendamento
-- Próximo passo: automação de postagem (ao horário → marcar publicado + notificar)
-- ============================================================

-- 1) Tabela de conteúdo (posts) do calendário
CREATE TABLE IF NOT EXISTS public.conteudo_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  titulo text,
  conteudo text NOT NULL,
  canal text NOT NULL DEFAULT 'geral' CHECK (canal IN ('geral', 'instagram', 'facebook', 'whatsapp', 'outro')),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho', 'em_aprovacao', 'aprovado', 'rejeitado', 'agendado', 'publicado'
  )),
  agendado_para timestamptz,
  publicado_em timestamptz,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_em timestamptz,
  rejeitado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejeitado_em timestamptz,
  motivo_rejeicao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conteudo_calendario_org ON public.conteudo_calendario(org_id);
CREATE INDEX IF NOT EXISTS idx_conteudo_calendario_status ON public.conteudo_calendario(org_id, status);
CREATE INDEX IF NOT EXISTS idx_conteudo_calendario_agendado ON public.conteudo_calendario(org_id, agendado_para) WHERE status = 'agendado';

COMMENT ON TABLE public.conteudo_calendario IS 'Calendário de conteúdo: rascunho → aprovação → agendamento → publicação (notificação no horário).';
COMMENT ON COLUMN public.conteudo_calendario.status IS 'rascunho → em_aprovacao → aprovado | rejeitado; aprovado pode virar agendado; no horário vira publicado.';
COMMENT ON COLUMN public.conteudo_calendario.agendado_para IS 'Quando deve ser considerado publicado (job marca publicado e notifica para postar manualmente).';

-- 2) RLS
ALTER TABLE public.conteudo_calendario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can manage conteudo_calendario" ON public.conteudo_calendario;
CREATE POLICY "org members can manage conteudo_calendario" ON public.conteudo_calendario
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- 3) Trigger updated_at (reusa função se existir)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_conteudo_calendario_updated_at ON public.conteudo_calendario;
CREATE TRIGGER trg_conteudo_calendario_updated_at
  BEFORE UPDATE ON public.conteudo_calendario
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
