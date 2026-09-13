# Aprimoramentos e implementações sugeridas

Ideias de melhorias e novas funcionalidades para o projeto, além do que já está em TRAVAMENTO-APP.md e FALTA-NO-BANCO.md.

---

## Já implementado nesta sessão

- **Sessão expirada (401)**  
  Em `auth.js`: `setupSessionExpiredRedirect()` escuta `SIGNED_OUT` e `TOKEN_REFRESH_FAILED` e redireciona para login limpando estado.  
  `redirectToLoginIfUnauthorized(error)` pode ser usada em serviços que fazem `fetch` direto (ex.: rotas `/api/*`) para redirecionar em caso de 401 ou JWT expirado.

---

## Segurança e configuração

- **Supabase URL e chave**  
  Em `js/core/supabase.js` a URL e a chave estão fixas no código. Em produção, usar variáveis de ambiente (ex.: build com substituição ou arquivo de config carregado por ambiente) para não expor a chave no repositório.

- **RLS e políticas**  
  Revisar todas as tabelas no Supabase e garantir políticas por `org_id` + `auth.uid()` (ex.: `org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid())`). Ver scripts em `supabase-rls-*.sql` e TRAVAMENTO-APP.md.

---

## UX e navegação

- **Hash sem ID**  
  Views que dependem de ID em `sessionStorage` (ex.: `#cliente-perfil`, `#profissional-perfil`): ao acessar o hash direto sem ID, redirecionar com toast em vez de tela em branco ou erro.

- **Org ativa**  
  Se não houver organização ativa (ex.: após troca de conta), exibir banner ou redirecionar para seleção de org / onboarding em vez de deixar o usuário em telas que dependem de `getActiveOrg()`.

---

## Dados e formulários

- **Validação no front e no banco**  
  Validar campos obrigatórios nos formulários e, onde fizer sentido, adicionar constraints no banco (ex.: procedimento com nome, transação com valor) para evitar estado inconsistente.

- **Migrações**  
  Rodar no Supabase os SQLs de migração (parcelamento, margem/comissão, anamnese modular, falta-no-banco, etc.) na ordem indicada em FALTA-NO-BANCO.md.

---

## API e erros

- **Uso de `redirectToLoginIfUnauthorized`**  
  Nos serviços que chamam APIs próprias (fetch para `/api/*`), em caso de resposta 401, chamar `redirectToLoginIfUnauthorized(err)` antes de fazer throw, para centralizar o redirecionamento para login.

- **Tratamento de erro**  
  Revisar `catch` vazios ou que só fazem `console.warn` e decidir se deve mostrar toast ou mensagem amigável ao usuário.

---

## Funcionalidades futuras (ideias)

- **Notificações em tempo real**  
  Usar Supabase Realtime em tabelas como `notificacoes` ou `organization_invites` para atualizar a UI sem recarregar.

- **Exportação/backup agendado**  
  Se já existir tela de backup/export, considerar agendamento (cron ou Edge Function) para export periódico.

- **Auditoria de ações sensíveis**  
  Garantir que exclusões e alterações críticas (cliente, procedimento, org) gerem registro em `audit_logs` e que a ação esteja coberta por permissão e RLS.

---

Para detalhes do que falta no banco (tabelas, RPCs, migrações), ver **FALTA-NO-BANCO.md** e **INTERLIGACAO.md**.
