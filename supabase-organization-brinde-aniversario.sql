-- Organização: opção de oferecer brinde de aniversário nas mensagens
-- A empresa escolhe em Cadastro da empresa se inclui oferta de brinde ao enviar mensagem de aniversário.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'brinde_aniversario_habilitado'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN brinde_aniversario_habilitado boolean NOT NULL DEFAULT false;

    COMMENT ON COLUMN public.organizations.brinde_aniversario_habilitado IS
      'Se true, as mensagens de aniversário sugeridas incluem oferta de brinde. A empresa decide se oferece ou não.';
  END IF;
END $$;
