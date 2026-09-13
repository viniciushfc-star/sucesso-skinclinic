-- Modelos de mensagem por organização: o master define textos personalizados (lembrete, aniversário, etc.)
-- O sistema só preenche placeholders: {nome_cliente}, {data}, {hora}, {nome_clinica}, {link_confirmar}

CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  body text NOT NULL DEFAULT '',
  subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_message_templates_org_tipo ON public.message_templates(org_id, tipo);

COMMENT ON TABLE public.message_templates IS 'Modelos de texto para envio ao cliente: lembrete de agendamento, aniversário, marketing. Placeholders: {nome_cliente}, {data}, {hora}, {nome_clinica}, {link_confirmar}';
COMMENT ON COLUMN public.message_templates.tipo IS 'lembrete_agendamento | lembrete_email_assunto | lembrete_email_corpo | aniversario | marketing';
COMMENT ON COLUMN public.message_templates.subject IS 'Para e-mail: assunto (tipo lembrete_email_assunto usa só subject).';

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members message_templates" ON public.message_templates;
CREATE POLICY "Org members message_templates"
  ON public.message_templates FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_message_templates_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tr_message_templates_updated ON public.message_templates;
CREATE TRIGGER tr_message_templates_updated
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE PROCEDURE public.set_message_templates_updated_at();
