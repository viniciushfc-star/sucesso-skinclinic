-- Limpeza segura (ordem combinada). Cole no SQL Editor e Run.
-- 1) Backup no Dashboard do Supabase (não é este arquivo).
-- 2) Liga RLS nas duas tabelas abertas.
-- 3) Mostra as linhas legadas (clientes / convites / logs) — NÃO apaga.
-- 4) Remove appointments SOMENTE se COUNT=0. Sem CASCADE.
-- Não dropa clientes, convites, logs, estoque, copiloto_chat, skincare_ia.

-- ---------- 2) RLS ----------
ALTER TABLE public.anamnesis_tipos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read anamnesis_tipos" ON public.anamnesis_tipos;
CREATE POLICY "auth read anamnesis_tipos"
  ON public.anamnesis_tipos
  FOR SELECT TO authenticated
  USING (true);

DO $$
BEGIN
  IF to_regclass('public.payment_fee_models') IS NULL THEN
    RAISE NOTICE 'payment_fee_models ausente — nada a ligar';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.payment_fee_models ENABLE ROW LEVEL SECURITY';
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_fee_models' AND column_name = 'org_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "org payment_fee_models" ON public.payment_fee_models';
    EXECUTE $p$
      CREATE POLICY "org payment_fee_models" ON public.payment_fee_models
        FOR ALL TO authenticated
        USING (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
        WITH CHECK (org_id IN (SELECT org_id FROM public.organization_users WHERE user_id = auth.uid()))
    $p$;
  ELSE
    RAISE NOTICE 'payment_fee_models: RLS on, sem org_id — escrita autenticada bloqueada (tabela vazia)';
  END IF;
END $$;

-- ---------- 4) appointments só se vazia ----------
DO $$
DECLARE
  n bigint;
BEGIN
  IF to_regclass('public.appointments') IS NULL THEN
    RAISE NOTICE 'appointments já não existe';
    RETURN;
  END IF;
  EXECUTE 'SELECT COUNT(*) FROM public.appointments' INTO n;
  IF n = 0 THEN
    DROP TABLE public.appointments;
    RAISE NOTICE 'appointments removida (estava vazia)';
  ELSE
    RAISE NOTICE 'appointments NÃO removida: % linha(s)', n;
  END IF;
END $$;

-- ---------- 3) Relatório: legado que ainda tem dado + RLS ----------
SELECT 'legado'::text AS tipo, 'clientes'::text AS item, COUNT(*)::text AS n,
       COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.clientes LIMIT 20) x), '[]'::jsonb)::text AS detalhe
FROM public.clientes
UNION ALL
SELECT 'legado', 'convites', COUNT(*)::text,
       COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.convites LIMIT 20) x), '[]'::jsonb)::text
FROM public.convites
UNION ALL
SELECT 'legado', 'logs', COUNT(*)::text,
       COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.logs LIMIT 20) x), '[]'::jsonb)::text
FROM public.logs
UNION ALL
SELECT 'rls', c.relname,
       CASE WHEN c.relrowsecurity THEN 'on' ELSE 'off' END,
       ''
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('anamnesis_tipos', 'payment_fee_models', 'appointments', 'agenda')
UNION ALL
SELECT 'par', 'agenda / appointments',
       CASE WHEN to_regclass('public.appointments') IS NULL THEN 'legado ausente' ELSE 'legado ainda existe' END,
       ''
;
