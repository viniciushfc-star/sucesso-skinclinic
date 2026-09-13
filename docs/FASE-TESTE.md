# Fase de teste — SkinClinic

Use este guia para deixar o ambiente pronto e testar os fluxos principais antes de ir para produção.

---

## 1. Antes de testar

### 1.1 Rodar o app

- Na pasta do projeto: `npx serve -c serve.json` (ou `npx serve . -l 3000`).
- Acesse `http://localhost:3000` (ou a porta indicada).
- Confira o **CONFIG.md** para Supabase (Redirect URLs, RLS ao criar organização).

### 1.2 Scripts SQL no Supabase (recomendado)

Rode no **SQL Editor** do Supabase, na ordem que fizer sentido para o seu projeto. Consulte **supabase-ordem-scripts.md** para a ordem completa. Mínimo sugerido para testar tudo:

| Script | Para quê |
|--------|----------|
| **supabase-rls-organizations.sql** / **supabase-rls-fix-403.sql** | Criar organização e acessar sem 403 |
| **supabase-organization-profile.sql** | Cadastro da empresa (nome, logo, cidade, etc.) |
| **supabase-menu-settings.sql** | Checkbox “Mostrar Anamnese no menu” (Empresa) |
| **supabase-clients-cpf-foto.sql** | Foto do cliente (avatar, bucket `client-photos`) |
| **supabase-audit-logs-rls-fix.sql** + **supabase-audit-logs-star.sql** | Tela de Auditoria sem 403 |
| **supabase-organization-user-permissions.sql** | Configurar permissões por usuário (Equipe) |
| **supabase-appointment-confirmations.sql** | Confirmação de horário por link (WhatsApp/portal) |
| **supabase-produto-avaliacoes.sql** | Avaliação de produtos / índice de cuidado (Estoque, Equipe) |

Os demais (anamnese, análise de pele, skincare, estoque, agenda, etc.) conforme você for testar cada módulo.

---

## 2. Checklist de fluxos

Marque conforme for testando.

### Autenticação e organização

- [ ] Login (e-mail/senha)
- [ ] Login com Google (se configurado)
- [ ] Criar clínica (organização) — sem 403
- [ ] Trocar de organização (se tiver mais de uma)
- [ ] Logout

### Cadastros e configurações

- [ ] **Configurações** (menu ⚙️): abrir e ver todos os cards (Empresa, Planos, Backup, Auditoria, Equipe, Visão geral)
- [ ] **Dados da empresa**: salvar nome, cidade, estado, logo, telefone; marcar/desmarcar “Mostrar Anamnese no menu” e ver item no menu
- [ ] **Salas**: cadastrar pelo menos uma sala e tipo de procedimento
- [ ] **Planos** (assinatura): listar e, se houver, assinar
- [ ] **Equipe**: convidar usuário, aprovar convite (em Configurações ou em Equipe)
- [ ] **Configurar permissões** (Equipe): alterar permissão de um usuário e ver efeito (ex.: esconder/mostrar item de menu)

### Clientes

- [ ] Listar clientes
- [ ] Adicionar cliente (nome, telefone/e-mail, opcional: foto)
- [ ] Tirar foto pela câmera no cadastro e ver foto no perfil
- [ ] Editar cliente (incluindo trocar foto) e ver avatar no cabeçalho do perfil
- [ ] Abrir perfil do cliente: dados, histórico, protocolo, rotina skincare
- [ ] Importar clientes em lote (CSV) — opção “Importar em lote” na tela Clientes

### Agenda

- [ ] Ver agenda (dia/semana)
- [ ] Agendar atendimento (cliente, procedimento, horário, sala se houver)
- [ ] Enviar link por WhatsApp (confirmação) — se tiver script de confirmação rodado
- [ ] (Portal) Cliente abrir link de confirmação e confirmar horário

### Financeiro

- [ ] Ver lista de transações
- [ ] Inserir transação manual
- [ ] Importar extrato (CSV)
- [ ] Filtrar por período

### Backup e exportação

- [ ] **Backup**: baixar backup (JSON)
- [ ] **Backup**: restaurar backup (usar o JSON baixado ou de teste)
- [ ] **Exportar e importar**: exportar clientes (CSV), exportar financeiro (CSV), backup completo
- [ ] **Exportar e importar**: importar em lote (clientes ou outro tipo) e restaurar backup único (JSON)

### Outros

- [ ] **Auditoria**: abrir tela, ver logs, “Carregar mais” e filtros
- [ ] **Copilot** (sino/notificações): abrir painel e enviar mensagem (pode retornar “não disponível” em dev)
- [ ] **Procedimentos**: criar/editar procedimento; planos terapêuticos (se usar)
- [ ] **Estoque**: entrada manual ou ler nota (OCR); avaliar produto (se script de avaliações rodado)
- [ ] **Portal do cliente**: acessar com link de sessão; ver rotina de skincare se liberada

---

## 3. Problemas comuns

| Sintoma | O que verificar |
|--------|------------------|
| 403 ao criar organização | RLS: rodar **supabase-rls-fix-403.sql** (ou equivalente) |
| Auditoria dá erro ao carregar | Rodar **supabase-audit-logs-rls-fix.sql** e **supabase-audit-logs-star.sql** |
| Foto do cliente não sobe | Bucket `client-photos` e RLS: **supabase-clients-cpf-foto.sql** |
| “Configurar permissões” quebra | Tabela de overrides: **supabase-organization-user-permissions.sql** |
| Link de confirmação de horário não funciona | **supabase-appointment-confirmations.sql** |
| Menu “Anamnese” não aparece/desaparece | **supabase-menu-settings.sql** e checkbox em Empresa → Salvar |
| Copilot retorna “não disponível” | Normal em localhost; em produção configurar rota `/api/copiloto` e variáveis (OpenAI, Supabase) |

---

## 4. Dados mínimos para testar

- **1 organização** (clínica)
- **1 usuário** com role master (quem criou a clínica)
- **1 cliente** (pode ser criado pela tela Clientes)
- **1 procedimento** (para agendar)
- **1 sala** (opcional; cadastrada em Empresa → Gerenciar salas)

Com isso dá para percorrer: login → seleção de org → Configurações → Empresa → Clientes → Agenda → Financeiro → Backup.

Quando todos os itens do checklist estiverem ok para os fluxos que você usa, o sistema está pronto para seguir para a próxima fase (homologação/produção).
