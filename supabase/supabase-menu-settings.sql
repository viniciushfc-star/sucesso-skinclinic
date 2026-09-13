-- ============================================================
-- Configurações do menu por organização (ex.: mostrar Anamnese no menu)
-- ============================================================

DO $migrate$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'menu_anamnese_visible') THEN
    ALTER TABLE public.organizations ADD COLUMN menu_anamnese_visible boolean DEFAULT false;
  END IF;
END $migrate$;

COMMENT ON COLUMN public.organizations.menu_anamnese_visible IS 'Se true, o item "Anamnese" aparece no menu lateral. Se false, a anamnese é acessada só pelo perfil do cliente.';
