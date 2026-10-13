-- Diagnóstico: o banco casa com o app? Há tabelas gêmeas?
-- Cole no SQL Editor e Run. Só lê. NÃO dropa nada.
-- COUNT(*) real (reltuples=-1 no Postgres só significa “sem ANALYZE”, não é negativo).

CREATE OR REPLACE FUNCTION pg_temp.count_public(p_table text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  n bigint;
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN NULL;
  END IF;
  EXECUTE format('SELECT COUNT(*) FROM public.%I', p_table) INTO n;
  RETURN n;
END;
$$;

WITH pares(canon, legado, motivo) AS (
  VALUES
    ('clients', 'clientes', 'paciente canônico é clients'),
    ('agenda', 'appointments', 'grade canônica é agenda'),
    ('organization_invites', 'convites', 'convite de equipe'),
    ('audit_logs', 'logs', 'auditoria canônica')
),
public_tables AS (
  SELECT
    c.relname AS nome,
    pg_temp.count_public(c.relname) AS linhas,
    c.relrowsecurity AS rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),
dup AS (
  SELECT
    p.canon,
    p.legado,
    p.motivo,
    EXISTS (SELECT 1 FROM public_tables t WHERE t.nome = p.canon) AS canon_existe,
    EXISTS (SELECT 1 FROM public_tables t WHERE t.nome = p.legado) AS legado_existe,
    (SELECT t.linhas FROM public_tables t WHERE t.nome = p.canon) AS canon_n,
    (SELECT t.linhas FROM public_tables t WHERE t.nome = p.legado) AS legado_n
  FROM pares p
)
SELECT
  'par' AS tipo,
  canon || ' / ' || legado AS item,
  CASE
    WHEN canon_existe AND NOT legado_existe THEN 'OK'
    WHEN NOT canon_existe AND legado_existe THEN 'FALTA'
    WHEN canon_existe AND legado_existe AND COALESCE(legado_n, 0) = 0 THEN 'OK'
    WHEN canon_existe AND legado_existe THEN 'ATENCAO'
    ELSE 'INFO'
  END AS status,
  motivo
    || ' | canônico ' || CASE WHEN canon_existe THEN COALESCE(canon_n, 0)::text ELSE 'ausente' END
    || ' | legado ' || CASE WHEN legado_existe THEN COALESCE(legado_n, 0)::text ELSE 'ausente' END
    || CASE
         WHEN canon_existe AND legado_existe AND COALESCE(legado_n, 0) = 0 THEN ' | legado vazio (candidato a limpeza depois de backup)'
         WHEN canon_existe AND legado_existe THEN ' | os dois existem — não apagar ainda'
         ELSE ''
       END
    AS detalhe
FROM dup

UNION ALL

SELECT
  'tabela_publica',
  nome,
  CASE WHEN rls THEN 'OK' ELSE 'ATENCAO' END,
  'linhas=' || linhas::text || CASE WHEN rls THEN ' | RLS on' ELSE ' | RLS off' END
FROM public_tables

ORDER BY tipo, item;
