-- ============================================================
-- Cláusula de consentimento específica por procedimento
-- Permite que o termo "se adapte" aos procedimentos: cada um pode ter
-- um texto adicional (riscos, cuidados, informações) exibido no
-- fluxo de consentimento. O advogado pode redigir por tipo de procedimento.
-- ============================================================

ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS termo_especifico text;

COMMENT ON COLUMN public.procedures.termo_especifico IS 'Cláusula adicional de consentimento para este procedimento (riscos, cuidados, informações). Exibida junto ao termo geral quando o cliente aceita o termo ou quando o procedimento está no plano/agenda. Texto redigido pelo advogado da clínica.';
