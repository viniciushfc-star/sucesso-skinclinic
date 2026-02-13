-- ============================================================
-- Corrige erro: invalid input syntax for type integer: "uuid..."
-- A tabela agenda estava com cliente_id, user_id ou org_id como
-- integer; o app envia UUID. Este script altera para UUID.
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

-- 1) cliente_id: passar para UUID (referência a clients ou clientes)
DO $migrate$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'cliente_id';

  IF col_type = 'integer' OR col_type = 'bigint' OR col_type = 'smallint' THEN
    ALTER TABLE public.agenda DROP COLUMN IF EXISTS cliente_id CASCADE;
    ALTER TABLE public.agenda ADD COLUMN cliente_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
  ELSIF col_type IS NULL THEN
    ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN others THEN
    -- Se clients não existir, tenta clientes
    IF col_type IN ('integer','bigint','smallint') THEN
      ALTER TABLE public.agenda DROP COLUMN IF EXISTS cliente_id CASCADE;
      ALTER TABLE public.agenda ADD COLUMN cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;
    END IF;
END $migrate$;

-- 2) user_id: passar para UUID (auth.users)
DO $migrate$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'user_id';

  IF col_type = 'integer' OR col_type = 'bigint' OR col_type = 'smallint' THEN
    ALTER TABLE public.agenda DROP COLUMN IF EXISTS user_id CASCADE;
    ALTER TABLE public.agenda ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  ELSIF col_type IS NULL THEN
    ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $migrate$;

-- 3) org_id: passar para UUID (organizations)
DO $migrate$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'org_id';

  IF col_type = 'integer' OR col_type = 'bigint' OR col_type = 'smallint' THEN
    ALTER TABLE public.agenda DROP COLUMN IF EXISTS org_id CASCADE;
    ALTER TABLE public.agenda ADD COLUMN org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
  ELSIF col_type IS NULL THEN
    ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $migrate$;
