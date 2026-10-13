-- Segunda leva: lixo legado sem org (jan/fev 2026). Cole e Run.
-- Não mexe em clients, organization_invites, audit_logs, agenda.
-- DELETE só se org_id IS NULL. DROP da tabela só se COUNT=0 depois.
-- clientes: não apaga id que ainda estiver em clients.legacy_cliente_id.

-- Quantos pacientes canônicos ainda apontam para o legado
SELECT 'vinculo'::text AS tipo, COUNT(*)::text AS n, 'clients.legacy_cliente_id preenchido'::text AS detalhe
FROM public.clients
WHERE legacy_cliente_id IS NOT NULL;

DO $$
DECLARE
  n bigint;
  ligados bigint;
BEGIN
  -- clientes
  IF to_regclass('public.clientes') IS NOT NULL THEN
    SELECT COUNT(*) INTO ligados
    FROM public.clientes c
    WHERE EXISTS (
      SELECT 1 FROM public.clients x
      WHERE x.legacy_cliente_id IS NOT NULL AND x.legacy_cliente_id = c.id
    );
    DELETE FROM public.clientes c
    WHERE c.org_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.clients x
        WHERE x.legacy_cliente_id IS NOT NULL AND x.legacy_cliente_id = c.id
      );
    SELECT COUNT(*) INTO n FROM public.clientes;
    IF n = 0 AND ligados = 0 THEN
      DROP TABLE public.clientes;
      RAISE NOTICE 'tabela clientes removida (vazia, sem vínculo)';
    ELSE
      RAISE NOTICE 'clientes permanece: % linha(s), % vinculadas a clients', n, ligados;
    END IF;
  END IF;

  -- convites
  IF to_regclass('public.convites') IS NOT NULL THEN
    DELETE FROM public.convites WHERE org_id IS NULL;
    SELECT COUNT(*) INTO n FROM public.convites;
    IF n = 0 THEN
      DROP TABLE public.convites;
      RAISE NOTICE 'tabela convites removida (vazia)';
    ELSE
      RAISE NOTICE 'convites permanece: % linha(s)', n;
    END IF;
  END IF;

  -- logs
  IF to_regclass('public.logs') IS NOT NULL THEN
    DELETE FROM public.logs WHERE org_id IS NULL;
    SELECT COUNT(*) INTO n FROM public.logs;
    IF n = 0 THEN
      DROP TABLE public.logs;
      RAISE NOTICE 'tabela logs removida (vazia)';
    ELSE
      RAISE NOTICE 'logs permanece: % linha(s)', n;
    END IF;
  END IF;
END $$;

SELECT 'par'::text AS tipo, item, n, detalhe FROM (
  SELECT 'clients / clientes'::text AS item,
         CASE WHEN to_regclass('public.clientes') IS NULL THEN 'legado ausente' ELSE 'legado ainda existe' END AS n,
         ''::text AS detalhe
  UNION ALL
  SELECT 'organization_invites / convites',
         CASE WHEN to_regclass('public.convites') IS NULL THEN 'legado ausente' ELSE 'legado ainda existe' END,
         ''
  UNION ALL
  SELECT 'audit_logs / logs',
         CASE WHEN to_regclass('public.logs') IS NULL THEN 'legado ausente' ELSE 'legado ainda existe' END,
         ''
) s;
