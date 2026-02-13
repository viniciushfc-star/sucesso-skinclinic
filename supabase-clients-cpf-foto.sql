-- ============================================================
-- CPF (evitar duplicado) + Foto (avatar) no cadastro do cliente
-- Execute no Supabase: SQL Editor -> New query -> Cole e Run
-- ============================================================

-- 1) Colunas na tabela clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2) Indice unico: mesmo CPF nao pode repetir na mesma organizacao (evita duplicado)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_org_cpf
  ON public.clients (org_id, cpf)
  WHERE cpf IS NOT NULL AND cpf != '';

-- 3) Bucket no Storage para fotos dos clientes
-- Se o INSERT abaixo der erro, crie o bucket no Dashboard: Storage -> New bucket
-- Nome: client-photos | Public: sim | Tamanho max: 5MB | Tipos: image/jpeg, image/png, image/webp, image/gif

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-photos',
  'client-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 4) RLS no Storage: membros da org podem ler/escrever fotos da propria org
-- Caminho dos arquivos: org_id/client_id/avatar.ext (primeiro segmento = org_id)

DROP POLICY IF EXISTS "Org members can read client photos" ON storage.objects;
CREATE POLICY "Org members can read client photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM organization_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can upload client photos" ON storage.objects;
CREATE POLICY "Org members can upload client photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-photos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM organization_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can update client photos" ON storage.objects;
CREATE POLICY "Org members can update client photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM organization_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can delete client photos" ON storage.objects;
CREATE POLICY "Org members can delete client photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND split_part(name, '/', 1) IN (
      SELECT org_id::text FROM organization_users WHERE user_id = auth.uid()
    )
  );
