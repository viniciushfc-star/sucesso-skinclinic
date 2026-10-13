-- Fase 0 leftover: cadastro da empresa, respiro da agenda, link de confirmação.
-- Cole no SQL Editor e Run. Idempotente.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS google_review_url text,
  ADD COLUMN IF NOT EXISTS fidelidade_visitas int DEFAULT 10,
  ADD COLUMN IF NOT EXISTS margem_alvo_padrao_pct numeric,
  ADD COLUMN IF NOT EXISTS comissao_profissional_padrao_pct numeric,
  ADD COLUMN IF NOT EXISTS vende_para_cliente boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS vende_para_profissional boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.agenda_config (
  org_id uuid PRIMARY KEY,
  respiro_sala_minutos int DEFAULT 10,
  respiro_profissional_minutos int DEFAULT 5,
  sala_obrigatoria boolean DEFAULT true,
  profissional_obrigatorio boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.appointment_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  token text NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
