-- Estoque: permitir tipo 'real' em estoque_consumo para indicador de acurácia
-- Consumo previsto = protocolo (tipo 'estimado'); consumo real = registrado pela clínica (tipo 'real').
-- Meta de acurácia ~85%: comparar real vs previsto por período.

DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'estoque_consumo' AND c.contype = 'c'
  LIMIT 1;

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.estoque_consumo DROP CONSTRAINT %I', conname);
  END IF;

  ALTER TABLE public.estoque_consumo
    ADD CONSTRAINT estoque_consumo_tipo_check
    CHECK (tipo IN ('estimado', 'ajuste', 'real'));
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- constraint já existe com os novos valores
END $$;

COMMENT ON COLUMN public.estoque_consumo.tipo IS 'estimado = previsto (protocolo aplicado); ajuste = correção manual; real = consumo real informado (para acurácia).';
