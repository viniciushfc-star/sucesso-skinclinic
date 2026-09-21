-- P1: copia cadastros da tabela legado `clientes` (id bigint) para `clients` (id uuid).
-- Não dá para reutilizar o mesmo id: Postgres recusa uuid = bigint.
-- Gera UUID novo e guarda o id antigo em legacy_cliente_id.
-- NÃO apaga `clientes`.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS legacy_cliente_id bigint;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_org_legacy_cliente
  ON public.clients (org_id, legacy_cliente_id)
  WHERE legacy_cliente_id IS NOT NULL;

INSERT INTO public.clients (
  id,
  org_id,
  name,
  email,
  phone,
  created_at,
  updated_at,
  state,
  status,
  legacy_cliente_id
)
SELECT
  gen_random_uuid(),
  c.org_id::uuid,
  COALESCE(NULLIF(btrim(c.nome), ''), 'Cliente'),
  NULLIF(btrim(c.email), ''),
  COALESCE(NULLIF(btrim(c.telefone), ''), 'migrado'),
  COALESCE(c.created_at, now()),
  now(),
  'em_acompanhamento',
  'active',
  c.id
FROM public.clientes c
WHERE c.org_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.clients x
    WHERE x.legacy_cliente_id IS NOT NULL
      AND x.legacy_cliente_id = c.id
      AND x.org_id::text = c.org_id::text
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.clients x
    WHERE x.org_id::text = c.org_id::text
      AND NULLIF(btrim(c.email), '') IS NOT NULL
      AND lower(btrim(x.email)) = lower(btrim(c.email))
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.clients x
    WHERE x.org_id::text = c.org_id::text
      AND NULLIF(regexp_replace(COALESCE(c.telefone, ''), '\D', '', 'g'), '') IS NOT NULL
      AND regexp_replace(COALESCE(c.telefone, ''), '\D', '', 'g') <> ''
      AND regexp_replace(COALESCE(x.phone, ''), '\D', '', 'g')
          = regexp_replace(COALESCE(c.telefone, ''), '\D', '', 'g')
  );
