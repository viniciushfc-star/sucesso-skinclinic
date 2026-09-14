-- ============================================================
-- DIAGNÓSTICO: o banco está compatível com o SkinClinic atual?
--
-- COMO USAR
-- 1) Abra o Supabase → SQL Editor
-- 2) Cole este arquivo inteiro e rode
-- 3) Olhe a coluna status:
--      OK      = existe como o app espera
--      FALTA   = o módulo quebra ou fica incompleto
--      ATENCAO = existe, mas P0-02 / privacidade / formato antigo
--      INFO    = fallback aceitável (ex.: tabela clientes em vez de clients)
--
-- NÃO altera dados. Só lê catalogs.
-- Funções pg_temp desaparecem ao fechar a sessão.
-- ============================================================

CREATE OR REPLACE FUNCTION pg_temp.diag_analise_urls()
RETURNS TABLE (tipo text, item text, nivel text, modulo text, status text, detalhe text)
LANGUAGE plpgsql AS $$
DECLARE
  n bigint := 0;
BEGIN
  tipo := 'p0-02';
  item := 'analise_pele.imagens URLs públicas';
  nivel := 'ALTO';
  modulo := 'P0-02';
  IF to_regclass('public.analise_pele') IS NULL THEN
    status := 'FALTA';
    detalhe := 'tabela ausente';
    RETURN NEXT;
    RETURN;
  END IF;
  BEGIN
    EXECUTE $q$
      SELECT COUNT(*) FROM public.analise_pele
      WHERE imagens::text ILIKE '%/object/public/analise-pele-fotos/%'
    $q$ INTO n;
  EXCEPTION WHEN undefined_column THEN
    status := 'FALTA';
    detalhe := 'coluna imagens ausente';
    RETURN NEXT;
    RETURN;
  END;
  IF n > 0 THEN
    status := 'ATENCAO';
  ELSE
    status := 'OK';
  END IF;
  detalhe := n::text || ' linha(s) com URL pública antiga';
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.diag_buckets()
RETURNS TABLE (tipo text, item text, nivel text, modulo text, status text, detalhe text)
LANGUAGE plpgsql AS $$
DECLARE
  r record;
  is_pub boolean;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('analise-pele-fotos', 'CRITICO', true, 'P0-02 fotos'),
      ('client-photos', 'ALTO', false, 'foto cliente/evolução'),
      ('org-logos', 'MEDIO', false, 'logo empresa'),
      ('anamnese-fotos', 'MEDIO', false, 'fotos anamnese')
    ) AS t(b_item, b_nivel, deve_privado, b_modulo)
  LOOP
    tipo := 'bucket';
    item := r.b_item;
    nivel := r.b_nivel;
    modulo := r.b_modulo;
    BEGIN
      SELECT b.public INTO is_pub FROM storage.buckets b WHERE b.id = r.b_item;
      IF NOT FOUND THEN
        status := 'FALTA';
        detalhe := 'criar bucket no Storage';
      ELSIF r.deve_privado AND COALESCE(is_pub, true) THEN
        status := 'ATENCAO';
        detalhe := 'bucket PUBLIC — rode supabase-analise-pele-p0-02-privacidade.sql';
      ELSIF COALESCE(is_pub, false) THEN
        status := 'OK';
        detalhe := 'público (esperado para este bucket no app atual)';
      ELSE
        status := 'OK';
        detalhe := 'privado';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      status := 'ATENCAO';
      detalhe := 'não foi possível ler storage.buckets (' || SQLERRM || ')';
    END;
    RETURN NEXT;
  END LOOP;
END;
$$;

WITH
esperado_tabela(item, nivel, modulo) AS (
  VALUES
    ('organizations', 'CRITICO', 'multi-org'),
    ('organization_users', 'CRITICO', 'auth P0-01'),
    ('organization_user_permissions', 'CRITICO', 'auth P0-01'),
    ('organization_invites', 'CRITICO', 'equipe'),
    ('clients', 'CRITICO', 'clientes/portal'),
    ('client_sessions', 'CRITICO', 'portal'),
    ('agenda', 'CRITICO', 'agenda'),
    ('financeiro', 'CRITICO', 'financeiro'),
    ('procedures', 'CRITICO', 'procedimentos'),
    ('analise_pele', 'CRITICO', 'análise de pele'),
    ('anamnesis_funcoes', 'CRITICO', 'anamnese'),
    ('anamnesis_registros', 'CRITICO', 'anamnese'),
    ('client_records', 'ALTO', 'portal'),
    ('client_protocols', 'ALTO', 'portal'),
    ('notificacoes', 'ALTO', 'agenda/marketing'),
    ('profiles', 'ALTO', 'equipe'),
    ('salas', 'ALTO', 'agenda'),
    ('skincare_rotinas', 'ALTO', 'portal skincare'),
    ('appointment_confirmations', 'ALTO', 'lembrete/confirmação'),
    ('agenda_waitlist', 'ALTO', 'CRM espera'),
    ('fiscal_documents', 'ALTO', 'contador'),
    ('fiscal_apuracoes', 'ALTO', 'contador'),
    ('google_calendar_connections', 'MEDIO', 'google calendar'),
    ('external_calendar_blocks', 'MEDIO', 'google calendar'),
    ('conteudo_calendario', 'MEDIO', 'calendário conteúdo'),
    ('estoque_entradas', 'MEDIO', 'estoque'),
    ('estoque_consumo', 'MEDIO', 'estoque'),
    ('contas_a_pagar', 'MEDIO', 'financeiro'),
    ('contas_vinculadas', 'MEDIO', 'webhook banco'),
    ('afazeres', 'MEDIO', 'equipe'),
    ('audit_logs', 'MEDIO', 'auditoria'),
    ('team_payment_models', 'MEDIO', 'equipe'),
    ('professional_procedures', 'MEDIO', 'equipe'),
    ('protocolos', 'MEDIO', 'protocolo'),
    ('protocolos_aplicados', 'MEDIO', 'protocolo'),
    ('planos_terapeuticos', 'MEDIO', 'planos'),
    ('planos_terapeuticos_procedimentos', 'MEDIO', 'planos'),
    ('estudo_casos', 'MEDIO', 'estudo de caso'),
    ('estudo_caso_perguntas', 'MEDIO', 'estudo de caso'),
    ('client_evolution_photos', 'MEDIO', 'fotos evolução'),
    ('anamnesis_campos_personalizados', 'MEDIO', 'anamnese'),
    ('whatsapp_logs', 'MEDIO', 'whatsapp'),
    ('organization_legal_documents', 'MEDIO', 'termos'),
    ('message_templates', 'MEDIO', 'mensagens'),
    ('agenda_config', 'MEDIO', 'agenda'),
    ('client_packages', 'MEDIO', 'pacotes'),
    ('package_consumptions', 'BAIXO', 'pacotes'),
    ('procedure_categories', 'BAIXO', 'procedimentos'),
    ('procedure_stock_usage', 'BAIXO', 'estoque'),
    ('produto_avaliacoes', 'BAIXO', 'índice cuidado'),
    ('participacao_lucros', 'BAIXO', 'financeiro'),
    ('client_events', 'BAIXO', 'portal eventos'),
    ('anamnesis_regras', 'BAIXO', 'anamnese score'),
    ('protocolos_descartaveis', 'BAIXO', 'protocolo'),
    ('planos', 'BAIXO', 'planos/copiloto'),
    ('assinaturas', 'BAIXO', 'limites'),
    ('org_settings', 'BAIXO', 'config'),
    ('push_tokens', 'BAIXO', 'PWA push'),
    ('organization_access_requests', 'BAIXO', 'acesso'),
    ('appointments', 'BAIXO', 'legado agenda'),
    ('clientes', 'INFO', 'legado (fallback se clients faltar)'),
    ('convites', 'INFO', 'legado convites'),
    ('copiloto_chat', 'BAIXO', 'histórico IA'),
    ('marketing_ia', 'BAIXO', 'histórico IA'),
    ('precificacao_ia', 'BAIXO', 'histórico IA'),
    ('protocolos_ia', 'BAIXO', 'histórico IA'),
    ('sugestoes_estoque', 'BAIXO', 'histórico IA')
),
esperado_coluna(tabela, coluna, nivel, modulo) AS (
  VALUES
    ('organizations', 'id', 'CRITICO', 'multi-org'),
    ('organizations', 'name', 'CRITICO', 'multi-org'),
    ('organizations', 'cidade', 'ALTO', 'empresa/marketing'),
    ('organizations', 'estado', 'ALTO', 'empresa/marketing'),
    ('organizations', 'cnpj', 'ALTO', 'empresa/fiscal'),
    ('organizations', 'google_review_url', 'ALTO', 'CRM'),
    ('organizations', 'fidelidade_visitas', 'ALTO', 'CRM'),
    ('organizations', 'regime_tributario', 'ALTO', 'contador'),
    ('organizations', 'aliquota_simples_pct', 'ALTO', 'contador'),
    ('organization_users', 'user_id', 'CRITICO', 'auth P0-01'),
    ('organization_users', 'org_id', 'CRITICO', 'auth P0-01'),
    ('organization_users', 'role', 'CRITICO', 'auth P0-01'),
    ('organization_user_permissions', 'user_id', 'CRITICO', 'auth P0-01'),
    ('organization_user_permissions', 'org_id', 'CRITICO', 'auth P0-01'),
    ('organization_user_permissions', 'permission', 'CRITICO', 'auth P0-01'),
    ('organization_user_permissions', 'allowed', 'CRITICO', 'auth P0-01'),
    ('clients', 'org_id', 'CRITICO', 'clientes'),
    ('clients', 'name', 'CRITICO', 'clientes'),
    ('client_sessions', 'token', 'CRITICO', 'portal'),
    ('client_sessions', 'client_id', 'CRITICO', 'portal'),
    ('client_sessions', 'org_id', 'CRITICO', 'portal'),
    ('client_sessions', 'expires_at', 'CRITICO', 'portal'),
    ('agenda', 'org_id', 'CRITICO', 'agenda'),
    ('agenda', 'data', 'CRITICO', 'agenda'),
    ('agenda', 'hora', 'CRITICO', 'agenda'),
    ('agenda', 'cliente_id', 'CRITICO', 'agenda'),
    ('agenda', 'duration_minutes', 'ALTO', 'agenda'),
    ('agenda', 'sala_id', 'ALTO', 'agenda'),
    ('agenda', 'user_id', 'ALTO', 'agenda'),
    ('agenda', 'reminder_sent_at', 'ALTO', 'lembrete'),
    ('agenda', 'cancelled_at', 'ALTO', 'portal/cancelar'),
    ('agenda', 'origem', 'ALTO', 'agenda pública'),
    ('financeiro', 'org_id', 'CRITICO', 'financeiro'),
    ('financeiro', 'valor', 'CRITICO', 'financeiro'),
    ('financeiro', 'tipo', 'CRITICO', 'financeiro'),
    ('financeiro', 'categoria', 'ALTO', 'copiloto'),
    ('financeiro', 'categoria_saida', 'ALTO', 'DRE'),
    ('financeiro', 'forma_pagamento', 'ALTO', 'financeiro'),
    ('financeiro', 'agenda_id', 'ALTO', 'relatório profissional'),
    ('analise_pele', 'org_id', 'CRITICO', 'análise de pele'),
    ('analise_pele', 'client_id', 'CRITICO', 'análise de pele'),
    ('analise_pele', 'imagens', 'CRITICO', 'P0-02 fotos'),
    ('analise_pele', 'ia_preliminar', 'CRITICO', 'P0-02 IA interna'),
    ('analise_pele', 'texto_validado', 'CRITICO', 'P0-02 portal'),
    ('analise_pele', 'status', 'CRITICO', 'P0-02'),
    ('analise_pele', 'consentimento_imagens', 'CRITICO', 'análise de pele'),
    ('analise_pele', 'respostas', 'ALTO', 'análise de pele'),
    ('anamnesis_registros', 'origem', 'ALTO', 'anamnese portal')
),
esperado_rpc(item, nivel, modulo) AS (
  VALUES
    ('get_client_session_by_token', 'CRITICO', 'portal'),
    ('get_client_by_token', 'CRITICO', 'portal'),
    ('client_complete_registration', 'CRITICO', 'portal'),
    ('submit_analise_pele', 'CRITICO', 'análise de pele'),
    ('get_analises_pele_by_token', 'CRITICO', 'P0-02 portal'),
    ('get_skincare_rotina_by_token', 'ALTO', 'portal skincare'),
    ('submit_anamnese_by_token', 'ALTO', 'anamnese portal'),
    ('list_anamnese_portal_by_token', 'ALTO', 'anamnese portal'),
    ('confirm_appointment_by_token', 'ALTO', 'confirmação'),
    ('client_sign_consent_only', 'ALTO', 'termo portal'),
    ('report_client_event', 'MEDIO', 'portal eventos'),
    ('list_portal_procedures', 'ALTO', 'portal agenda'),
    ('list_portal_busy_hours', 'ALTO', 'portal agenda'),
    ('list_portal_appointments', 'ALTO', 'portal agenda'),
    ('create_portal_appointment', 'ALTO', 'portal agenda'),
    ('reschedule_portal_appointment', 'ALTO', 'portal agenda'),
    ('cancel_portal_appointment', 'ALTO', 'portal agenda'),
    ('get_public_clinic', 'ALTO', 'agenda pública'),
    ('list_public_procedures', 'ALTO', 'agenda pública'),
    ('list_public_busy_hours', 'ALTO', 'agenda pública'),
    ('create_public_appointment', 'ALTO', 'agenda pública')
),
tab_ok AS (
  SELECT c.relname AS nome
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v')
),
col_ok AS (
  SELECT table_name AS tabela, column_name AS coluna
  FROM information_schema.columns
  WHERE table_schema = 'public'
),
rpc_ok AS (
  SELECT p.proname AS nome, pg_get_function_result(p.oid) AS resultado
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
),
chk_tabelas AS (
  SELECT
    'tabela'::text AS tipo,
    e.item,
    e.nivel,
    e.modulo,
    CASE
      WHEN t.nome IS NOT NULL THEN 'OK'
      WHEN e.item = 'clients' AND EXISTS (SELECT 1 FROM tab_ok WHERE nome = 'clientes') THEN 'INFO'
      ELSE 'FALTA'
    END AS status,
    CASE
      WHEN t.nome IS NOT NULL THEN 'tabela existe'
      WHEN e.item = 'clients' AND EXISTS (SELECT 1 FROM tab_ok WHERE nome = 'clientes') THEN 'clients ausente; app tenta fallback em clientes'
      ELSE 'criar via script correspondente em supabase/'
    END AS detalhe
  FROM esperado_tabela e
  LEFT JOIN tab_ok t ON t.nome = e.item
),
chk_colunas AS (
  SELECT
    'coluna'::text AS tipo,
    e.tabela || '.' || e.coluna AS item,
    e.nivel,
    e.modulo,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM tab_ok WHERE nome = e.tabela) THEN 'FALTA'
      WHEN c.coluna IS NOT NULL THEN 'OK'
      WHEN e.tabela = 'client_sessions' AND e.coluna = 'client_id'
        AND EXISTS (SELECT 1 FROM col_ok WHERE tabela = 'client_sessions' AND coluna = 'cliente_id') THEN 'ATENCAO'
      WHEN e.tabela = 'analise_pele' AND e.coluna = 'client_id'
        AND EXISTS (SELECT 1 FROM col_ok WHERE tabela = 'analise_pele' AND coluna = 'cliente_id') THEN 'ATENCAO'
      ELSE 'FALTA'
    END AS status,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM tab_ok WHERE nome = e.tabela) THEN 'tabela não existe'
      WHEN c.coluna IS NOT NULL THEN 'coluna existe'
      WHEN e.coluna IN ('client_id') THEN 'existe cliente_id legado; rode script de rename'
      ELSE 'ALTER/script em supabase/ correspondente'
    END AS detalhe
  FROM esperado_coluna e
  LEFT JOIN col_ok c ON c.tabela = e.tabela AND c.coluna = e.coluna
),
chk_rpc AS (
  SELECT
    'rpc'::text AS tipo,
    e.item,
    e.nivel,
    e.modulo,
    CASE WHEN r.nome IS NOT NULL THEN 'OK' ELSE 'FALTA' END AS status,
    COALESCE(r.resultado, 'função não encontrada') AS detalhe
  FROM esperado_rpc e
  LEFT JOIN (SELECT DISTINCT ON (nome) nome, resultado FROM rpc_ok ORDER BY nome) r ON r.nome = e.item
),
chk_p002_rpc AS (
  SELECT
    'p0-02'::text AS tipo,
    'get_analises_pele_by_token formato'::text AS item,
    'CRITICO'::text AS nivel,
    'P0-02'::text AS modulo,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM rpc_ok WHERE nome = 'get_analises_pele_by_token') THEN 'FALTA'
      WHEN EXISTS (
        SELECT 1 FROM rpc_ok
        WHERE nome = 'get_analises_pele_by_token'
          AND resultado ILIKE '%SETOF%analise_pele%'
      ) THEN 'ATENCAO'
      WHEN EXISTS (
        SELECT 1 FROM rpc_ok
        WHERE nome = 'get_analises_pele_by_token'
          AND resultado ILIKE '%texto_validado%'
          AND resultado NOT ILIKE '%ia_preliminar%'
      ) THEN 'OK'
      ELSE 'ATENCAO'
    END AS status,
    COALESCE(
      (SELECT string_agg(DISTINCT resultado, ' | ') FROM rpc_ok WHERE nome = 'get_analises_pele_by_token'),
      'RPC ausente — rode supabase-analise-pele-p0-02-privacidade.sql'
    ) AS detalhe
),
chk_rls AS (
  SELECT
    'rls'::text AS tipo,
    c.relname AS item,
    'ALTO'::text AS nivel,
    'isolamento'::text AS modulo,
    CASE WHEN c.relrowsecurity THEN 'OK' ELSE 'ATENCAO' END AS status,
    CASE WHEN c.relrowsecurity THEN 'RLS ligado' ELSE 'RLS desligado nesta tabela' END AS detalhe
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN (
      'organizations','organization_users','clients','client_sessions','agenda','financeiro',
      'analise_pele','anamnesis_registros','client_records','fiscal_documents','agenda_waitlist'
    )
),
relatorio AS (
  SELECT * FROM chk_tabelas
  UNION ALL SELECT * FROM chk_colunas
  UNION ALL SELECT * FROM chk_rpc
  UNION ALL SELECT * FROM chk_p002_rpc
  UNION ALL SELECT * FROM pg_temp.diag_buckets()
  UNION ALL SELECT * FROM chk_rls
  UNION ALL SELECT * FROM pg_temp.diag_analise_urls()
)
SELECT
  status,
  nivel,
  tipo,
  item,
  modulo,
  detalhe
FROM relatorio
ORDER BY
  CASE status WHEN 'FALTA' THEN 0 WHEN 'ATENCAO' THEN 1 WHEN 'INFO' THEN 2 ELSE 3 END,
  CASE nivel WHEN 'CRITICO' THEN 0 WHEN 'ALTO' THEN 1 WHEN 'MEDIO' THEN 2 WHEN 'BAIXO' THEN 3 ELSE 4 END,
  tipo,
  item;
