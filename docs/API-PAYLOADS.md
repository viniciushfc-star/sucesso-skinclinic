# Payloads das APIs — Sistema Completo

Todas as rotas assumem **Content-Type: application/json** quando há body. Base URL em desenvolvimento: `http://localhost:3000`.

---

## 1. Copilot — `POST /api/copiloto`

Pergunta contextual ao Copilot (dados da clínica + OpenAI).

```json
{
  "pergunta": "Como está a agenda desta semana?",
  "user_id": "uuid-do-usuario-auth",
  "org_id": "uuid-da-organizacao",
  "contextoNotificacao": {
    "titulo": "Resumo financeiro",
    "mensagem": "Faturamento do mês: R$ 45.200"
  }
}
```

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `pergunta` | Sim | Texto da pergunta. |
| `user_id` | Sim | UUID do usuário (ex.: `auth.uid()`). |
| `org_id` | Não | UUID da organização (filtra dados por org). |
| `contextoNotificacao` | Não | `{ titulo, mensagem }` — contexto da notificação que originou a pergunta. |

**Resposta:** `{ "resposta": "..." }`

---

## 2. Preço — `POST /api/preco`

Sugestão de preço com base em custos, protocolo e mercado.

```json
{
  "custos": { "fixos": 5000, "variaveis": 30 },
  "protocolo": "Limpeza + peeling, 4 sessões",
  "mercado": "Região centro, ticket R$ 200–400"
}
```

**Resposta:** objeto do tipo `response.choices[0].message` (OpenAI), com JSON no content: `preco_min`, `preco_ideal`, `margem`, `parcelamento`, `justificativa`.

---

## 3. Marketing — `POST /api/marketing`

Sugestões de marketing (público, conteúdo, métricas de tráfego pago).

```json
{
  "nicho": "Estética facial",
  "cidade": "São Paulo",
  "ticket": "R$ 150–300",
  "procedimentos": "Limpeza, peeling, preenchimento",
  "org_id": "uuid-da-organizacao"
}
```

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `nicho` | Sim | Nicho da clínica. |
| `cidade` | Sim | Cidade. |
| `ticket` | Sim | Faixa de ticket. |
| `procedimentos` | Sim | Procedimentos ofertados. |
| `org_id` | Não | Se enviado, usa dados reais da clínica (planos, procedures, agenda). |

**Resposta:** `{ "content": "...", "role": "assistant" }`

---

## 4. OCR — `POST /api/ocr`

OCR de imagem ou interpretação de texto (nota fiscal / compra).

**Opção A — imagem em base64:**
```json
{
  "imageBase64": "string-base64-da-imagem"
}
```

**Opção B — só interpretar texto (sem OCR):**
```json
{
  "text": "Texto da nota fiscal...",
  "parseOnly": true
}
```

**Resposta:** `{ "text": "...", "parsed": { "fornecedor", "data", "itens": [...] } }` ou `{ "error", "text" }`

---

## 5. Estoque — `POST /api/estoque`

Sugestões de estoque (riscos, quando comprar, alertas).

```json
{
  "estoque": [
    { "produto": "Ácido hialurônico", "quantidade": 5, "validade": "2025-06-01" }
  ],
  "consumo": [
    { "produto": "Ácido hialurônico", "media_mensal": 3 }
  ]
}
```

**Resposta:** `response.choices[0].message` com JSON no content: `riscos`, `sugestoes`, `alertas`.

---

## 6. Estudo de caso — pergunta — `POST /api/estudo-caso-pergunta`

Pergunta sobre um caso ou esclarecimento após leitura de artigo.

```json
{
  "caso_resumo": {
    "tipo_pele": "Oleosa",
    "queixa_principal": "Acne grau II",
    "resposta_observada": "Melhora em 6 sessões",
    "n_sessoes": 6,
    "observacao": "Fototipo III"
  },
  "pergunta": "Quais procedimentos complementares podem ajudar?",
  "artigo_contexto": "Texto do artigo que o profissional leu (opcional)",
  "tipo": "esclarecer"
}
```

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `pergunta` | Sim | Pergunta do profissional. |
| `caso_resumo` | Não | Objeto com tipo_pele, queixa_principal, resposta_observada, n_sessoes, observacao. |
| `artigo_contexto` | Não | Contexto/artigo lido (para tipo esclarecer). |
| `tipo` | Não | `"esclarecer"` = dúvida sobre artigo/tema; omitir = pergunta sobre caso. |

**Resposta:** `{ "resposta_ia": "...", "role": "assistant" }`

---

## 7. Estudo de caso — esclarecer — `POST /api/estudo-caso-esclarecer`

Esclarecer dúvida após leitura de artigo/tema.

```json
{
  "texto_artigo_ou_tema": "Trecho ou resumo do artigo que o profissional leu",
  "duvida": "Qual a diferença entre retinol e ácido retinóico?"
}
```

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `duvida` | Sim | Dúvida do profissional. |
| `texto_artigo_ou_tema` | Não | Tema ou trecho do artigo. |

**Resposta:** `{ "resposta": "...", "role": "assistant" }`

---

## 8. Discussão de caso — `POST /api/discussao-caso`

Opinião da IA sobre um caso descrito (raciocínio, procedimentos, referências).

```json
{
  "caso": "Paciente 35 anos, melasma resistente, já usou hidroquinona. Fototipo IV. Quer resultado em 3 meses."
}
```

Ou `"caso"` pode ser um objeto (será convertido em JSON string).

**Resposta:** `{ "content": "...", "role": "assistant" }`

---

## 9. Protocolo — `POST /api/protocolo`

Geração de protocolo clínico a partir de análise e dados do cliente.

```json
{
  "analise": {
    "problemas": ["acne", "oleosidade"],
    "gravidade": { "acne": "moderado" },
    "prioridades": ["acne", "textura"]
  },
  "dados": {
    "nome": "Maria",
    "idade": 28,
    "tipo_pele": "Oleosa"
  }
}
```

**Resposta:** `response.choices[0].message` com JSON: `procedimentos`, `cronograma`, `cuidados`, `tempo_estimado`.

---

## 10. Pele (análise facial) — `POST /api/pele`

Análise de imagens + dados (problemas, gravidade, prioridades). Imagens em URL (data URL ou http).

```json
{
  "imagens": [
    "data:image/jpeg;base64,/9j/4AAQ...",
    "https://exemplo.com/foto2.jpg"
  ],
  "dados": {
    "idade": 30,
    "tipo_pele": "Mista"
  }
}
```

**Resposta:** `response.choices[0].message` com JSON: `problemas`, `gravidade`, `prioridades`, `observacoes`.

---

## 11. Skincare — `POST /api/skincare` ou `POST /api/skincare-ai`

Plano de skincare domiciliar (manhã, noite, semanal, alertas).

```json
{
  "analise": {
    "problemas": ["acne", "manchas"],
    "gravidade": {},
    "prioridades": []
  },
  "protocolo": {
    "procedimentos": ["Limpeza", "Peeling"],
    "cronograma": [],
    "cuidados": []
  }
}
```

**Resposta:** `response.choices[0].message` com JSON: `manha`, `noite`, `semanal`, `alertas`.

---

## 12. Análise de pele (portal do cliente) — `POST /api/analise-pele`

Análise de pele no portal (token de sessão, consentimento, imagens, respostas). Usado pelo **portal do cliente**.

```json
{
  "token": "token-da-sessao-portal",
  "consentimento_imagens": true,
  "menor_responsavel": "Nome do responsável (se menor)",
  "imagens": ["base64-ou-data-url-1", "base64-ou-data-url-2"],
  "respostas": {
    "queixa_principal": "Manchas e oleosidade",
    "quando_comecou": "Há 2 anos",
    "ja_tentou": "Ácido retinóico",
    "como_se_sente": "Incomodada"
  }
}
```

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `token` | Sim | Token da sessão do cliente (RPC `get_client_session_by_token`). |
| `consentimento_imagens` | Sim | Confirmação de uso das imagens. |
| `menor_responsavel` | Não | Nome do responsável se for menor. |
| `imagens` | Não | Array de base64 ou data URL (até 5). |
| `respostas` | Não | Objeto com respostas do questionário. |

**Resposta:** depende do fluxo (ex.: `{ "analise_id", "texto_validado", ... }` ou erro).

---

## 13. Calendário de conteúdo — `GET` ou `POST /api/calendario-conteudo`

Processa posts agendados cujo horário já passou (marca como publicado e cria notificação). Uso típico: cron ou front.

**GET:**  
`GET /api/calendario-conteudo?action=processar-agendados`

**POST:**
```json
{
  "action": "processar-agendados"
}
```

**Resposta:** `{ "ok": true, "processados": 3 }`

---

## 14. Webhook de transações — `POST /api/webhook-transacoes`

Recebe transações do agregador (Belvo, Pluggy, etc.). Header: `X-Webhook-Secret` ou `X-Webhook-Transactions-Secret` com o valor de `WEBHOOK_TRANSACTIONS_SECRET`.

```json
{
  "account_id": "external_account_id-da-conta-vinculada",
  "transactions": [
    {
      "date": "2025-02-05",
      "amount": -150.00,
      "description": "Pagamento fornecedor",
      "type": "debit"
    },
    {
      "date": "2025-02-04",
      "amount": 320.50,
      "description": "Recebimento cliente",
      "type": "credit"
    }
  ]
}
```

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `account_id` | Sim | ID externo da conta (deve existir em `contas_vinculadas.external_account_id`). |
| `transactions` | Sim | Array de `{ date, amount, description, type }`. `type`: credit/debit ou entrada/saida; se omitido, amount > 0 = entrada. |

**Resposta:** `{ "ok": true, "inseridos": 2 }` ou erro 400/401/404.

---

## 15. Google Calendar — autenticação

**GET /api/google-calendar/auth**  
Query: `userId`, `orgId`. Redireciona para o OAuth do Google; após login, o usuário volta em `/api/google-calendar/callback?code=...&state=...`.

**GET /api/google-calendar/callback**  
Query: `code`, `state` (retorno do Google). Não envia body.

**GET /api/google-calendar/status?orgId=uuid**  
Verifica se a org tem conexão Google Calendar. Sem body.

---

## 16. Google Calendar — sync e disconnect

Requer **Authorization: Bearer &lt;JWT do Supabase&gt;** (usuário autenticado da org).

**POST /api/google-calendar/sync**
```json
{
  "orgId": "uuid-da-organizacao",
  "userId": "uuid-do-usuario"
}
```
`userId` opcional; se omitido, sincroniza todos os usuários conectados da org.

**POST /api/google-calendar/disconnect**
```json
{
  "orgId": "uuid-da-organizacao",
  "userId": "uuid-do-usuario"
}
```

---

## Resumo rápido

| Rota | Método | Body principal |
|------|--------|----------------|
| `/api/copiloto` | POST | `pergunta`, `user_id`, `org_id?`, `contextoNotificacao?` |
| `/api/preco` | POST | `custos`, `protocolo`, `mercado` |
| `/api/marketing` | POST | `nicho`, `cidade`, `ticket`, `procedimentos`, `org_id?` |
| `/api/ocr` | POST | `imageBase64` ou `text` + `parseOnly` |
| `/api/estoque` | POST | `estoque`, `consumo` |
| `/api/estudo-caso-pergunta` | POST | `pergunta`, `caso_resumo?`, `artigo_contexto?`, `tipo?` |
| `/api/estudo-caso-esclarecer` | POST | `duvida`, `texto_artigo_ou_tema?` |
| `/api/discussao-caso` | POST | `caso` |
| `/api/protocolo` | POST | `analise`, `dados` |
| `/api/pele` | POST | `imagens`, `dados` |
| `/api/skincare` | POST | `analise`, `protocolo` |
| `/api/analise-pele` | POST | `token`, `consentimento_imagens`, `imagens?`, `respostas?`, `menor_responsavel?` |
| `/api/calendario-conteudo` | GET/POST | Query/body: `action=processar-agendados` |
| `/api/webhook-transacoes` | POST | `account_id`, `transactions` + header secret |
| `/api/google-calendar/sync` | POST | `orgId`, `userId?` + Bearer token |
| `/api/google-calendar/disconnect` | POST | `orgId`, `userId` + Bearer token |
