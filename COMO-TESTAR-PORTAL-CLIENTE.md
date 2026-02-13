# Como testar o Portal do Cliente

Guia rápido para ver como o portal do cliente ficou e testar todas as funcionalidades.

---

## 1. Como o portal funciona

O portal é uma **SPA separada** (`portal.html`) que o cliente acessa sempre por **link com token**. Não precisa fazer login como staff; o token já identifica o cliente.

**Arquivo principal:** `portal.html`  
**JavaScript:** `js/Client/portal.js` (roteador) + módulos em `js/Client/*.client.js`

---

## 2. Rotas disponíveis no portal

| Rota | Arquivo | O que faz |
|------|---------|-----------|
| `#completar-cadastro` | `completar-cadastro.client.js` | Formulário para cliente completar dados + aceitar termo |
| `#termo-consent` | `termo-consent.client.js` | Só assinar termo (link com `?mode=consent`) |
| `#dashboard` | `dashboard.client.js` | Painel principal: tratamento, orientações, ações |
| `#analise-pele` | `analise-pele.client.js` | Análise de pele por IA (fotos + respostas) |
| `#skincare-rotina` | `skincare-rotina.client.js` | Rotina de skincare liberada pela clínica |
| `#mensagens` | `mensagens.client.views.js` | Mensagens/relatos do cliente |

---

## 3. Como gerar um link de teste (do dashboard da clínica)

### Opção 1: Pelo código (no dashboard da clínica)

1. Abra o **dashboard da clínica** (`dashboard.html`).
2. Vá em **Clientes** → selecione um cliente.
3. No perfil do cliente, procure o botão **"Gerar link do portal"** ou **"Enviar link de cadastro"**.
4. O sistema chama `createClientPortalSession(clientId)` que:
   - Cria uma sessão na tabela `client_sessions` (token válido por 30 dias).
   - Retorna o token e a URL completa: `http://localhost:3000/portal.html?token=XYZ...`
5. Copie o link e abra em outra aba (ou envie para testar).

### Opção 2: Direto no Supabase (SQL)

Se você quiser criar um token manualmente para teste:

```sql
-- 1) Pegue o ID de um cliente existente (substitua pelo ID real)
-- SELECT id, name, org_id FROM clients LIMIT 1;

-- 2) Crie uma sessão manualmente (substitua CLIENT_ID e ORG_ID)
INSERT INTO client_sessions (org_id, client_id, token, expires_at)
VALUES (
  'SEU_ORG_ID_AQUI',
  'SEU_CLIENT_ID_AQUI',
  gen_random_uuid()::text || '-' || encode(gen_random_bytes(12), 'hex'),
  now() + interval '30 days'
)
RETURNING token;
```

Depois use o token retornado na URL:
```
http://localhost:3000/portal.html?token=TOKEN_RETORNADO
```

---

## 4. Fluxo de teste completo

### Passo 1: Criar cliente de teste (se não tiver)

1. No dashboard da clínica: **Clientes** → **Novo cliente**.
2. Preencha nome básico (ex.: "Maria Teste").
3. Salve.

### Passo 2: Gerar link do portal

1. Abra o perfil do cliente.
2. Clique em **"Gerar link do portal"** ou **"Enviar link de cadastro"**.
3. Copie o link (ex.: `http://localhost:3000/portal.html?token=abc-123...`).

### Passo 3: Testar o portal

1. Abra o link em uma **aba anônima** (ou outro navegador) para simular o cliente.
2. O portal vai:
   - Validar o token.
   - Se o cliente **não completou cadastro** → mostra `#completar-cadastro`.
   - Se já completou → mostra `#dashboard`.

### Passo 4: Completar cadastro (primeira vez)

1. Preencha o formulário:
   - Nome completo (obrigatório).
   - CPF (com máscara automática).
   - Telefone ou e-mail (pelo menos um).
   - Data de nascimento, sexo, observações (opcionais).
2. Leia e aceite o **Termo de Consentimento** (checkbox obrigatório).
3. Opcionalmente, autorize uso de imagem para divulgação.
4. Clique em **"Enviar cadastro"**.
5. Deve aparecer: "Cadastro completo" e link "Ir para o painel".

### Passo 5: Dashboard do cliente

Após completar cadastro, você vai para `#dashboard` que mostra:

- **"Seu tratamento"**: se há protocolo ativo ou não.
- **"Orientações recentes"**: registros compartilhados (`client_records`).
- **Botões de ação**:
  - **"Análise de pele"** → abre `#analise-pele`.
  - **"Minha rotina de skincare"** (se clínica liberou) → `#skincare-rotina`.
  - **"Ver evolução"** → rota futura.
  - **"Relatar evento"** → formulário para relatar sintoma/reação/dúvida.
  - **"Relatar reação ou dúvida"** → `#mensagens`.

### Passo 6: Testar análise de pele

1. No dashboard, clique em **"Análise de pele"**.
2. Preencha o consentimento de uso de imagens.
3. Tire/adicione fotos (até 5).
4. Responda o questionário (queixa principal, quando começou, etc.).
5. Envie.
6. A IA gera análise preliminar; a clínica valida depois.

### Passo 7: Testar relato de evento

1. No dashboard, clique em **"Relatar evento"**.
2. Preencha tipo (ex.: "Reação na pele") e descrição.
3. Envie.
4. O evento aparece na linha do tempo do cliente (no dashboard da clínica).

---

## 5. Links especiais

### Link de confirmação de horário

Se você gerar um link de confirmação de agendamento (via WhatsApp ou manual):

```
http://localhost:3000/portal.html?confirmToken=XYZ...
```

O portal:
- Confirma o horário automaticamente.
- Mostra "Horário confirmado! Obrigado."
- Permite fechar a página.

### Link só para assinar termo

Se você quiser que o cliente assine só o termo (sem completar cadastro):

```
http://localhost:3000/portal.html?token=XYZ...&mode=consent
```

Vai direto para `#termo-consent` (só assinatura do termo).

---

## 6. O que verificar no teste

- [ ] Token inválido/expirado mostra mensagem amigável.
- [ ] Formulário de cadastro valida campos obrigatórios.
- [ ] CPF tem máscara automática (000.000.000-00).
- [ ] Termo de consentimento é obrigatório.
- [ ] Após completar cadastro, vai para dashboard.
- [ ] Dashboard mostra orientações se houver.
- [ ] Botão "Análise de pele" funciona.
- [ ] Botão "Relatar evento" abre formulário e envia.
- [ ] Rotina de skincare aparece se clínica liberou.
- [ ] Navegação entre rotas (`#dashboard`, `#analise-pele`, etc.) funciona.

---

## 7. Troubleshooting

**"Sessão expirada ou inválida"**
- Token expirou (30 dias) ou não existe.
- Gere um novo link pelo dashboard da clínica.

**"Link inválido ou expirado"**
- Verifique se o token está correto na URL.
- Confirme que a tabela `client_sessions` tem a sessão ativa.

**Portal não carrega**
- Verifique se `portal.html` existe na raiz do projeto.
- Confirme que `js/Client/portal.js` está sendo carregado.
- Veja o console do navegador para erros.

**Rota não funciona**
- Verifique se o hash está correto (ex.: `#dashboard`, não `dashboard`).
- Confirme que o módulo da rota existe em `js/Client/`.

---

## 8. Estrutura de arquivos do portal

```
portal.html                          ← HTML principal
js/Client/
  ├── portal.js                      ← Roteador principal
  ├── client-portal.service.js        ← Serviços (API calls)
  ├── completar-cadastro.client.js    ← Tela de cadastro
  ├── termo-consent.client.js         ← Assinatura de termo
  ├── dashboard.client.js             ← Painel principal
  ├── analise-pele.client.js          ← Análise de pele
  ├── skincare-rotina.client.js       ← Rotina de skincare
  ├── mensagens.client.views.js       ← Mensagens
  └── ui/
      └── toast.client.js             ← Notificações
```

---

## 9. Próximos passos para testar

1. **Crie um cliente de teste** no dashboard da clínica.
2. **Gere o link do portal** (botão no perfil do cliente).
3. **Abra o link** em aba anônima.
4. **Complete o cadastro** e navegue pelo dashboard.
5. **Teste análise de pele** (se API estiver configurada).
6. **Teste relato de evento** e veja se aparece no dashboard da clínica.

Se precisar de ajuda para gerar o token manualmente ou debugar algum problema, me avise!
