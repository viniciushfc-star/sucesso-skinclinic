# Termo por momento e por contrato — como aplicar o certo em cada situação

Objetivo: **o termo certo, no momento certo**, com **dados do cliente (nome, CPF, contato)** e **procedimento(s)** identificados, para evitar erros e dar respaldo jurídico à clínica.

---

## Princípios

1. **Um contrato = um contexto claro:** sempre que houver aceite, deve ficar registrado **quem** (nome, CPF, contato), **quando** e **o quê** (termo geral e/ou cláusulas de quais procedimentos).
2. **Dados no termo:** o texto exibido ou impresso deve trazer os dados reais (nome, CPF, e-mail, telefone, data de nascimento quando aplicável) para o cliente **confirmar que está correto** antes de aceitar — evita erro de identidade e reforça o vínculo contrato–cliente.
3. **Por procedimento:** além do termo geral (prestação de serviços, direito de imagem, LGPD), procedimentos podem ter **cláusula específica** (riscos, cuidados). Essas cláusulas devem aparecer quando o atendimento envolver aquele procedimento.
4. **Maturidade do sistema:** implementar em fases para não quebrar o que já existe.

---

## Momentos de consentimento

| Momento | Onde | O que mostrar | O que guardar |
|--------|------|----------------|----------------|
| **1. Completar cadastro** | Portal (link enviado pela clínica) | Termo geral + opção de imagem. **Resumo:** "Você está aceitando como: [Nome], CPF [X], contato [Y]. Confira se está correto." | `clients`: consent_terms_accepted_at, consent_image_use, consent_terms_version; nome, CPF, telefone, e-mail (já salvos). Auditoria: cliente X completou cadastro e aceitou termo. |
| **2. Antes do atendimento (futuro)** | Link de confirmação de agendamento ou tela "pré-atendimento" | Termo geral + **cláusulas dos procedimentos** daquele agendamento. Resumo com nome, CPF, contato e **nome do(s) procedimento(s)**. | Registro de aceite vinculado ao agendamento (client_id + appointment_id + procedure_ids + snapshot dos dados no momento do aceite). |
| **3. Aceite em papel** | Dashboard → Perfil do cliente | Staff registra data e versão; pode indicar "termo geral" ou procedimento(s). | Atualiza clients (consent_*) e/ou tabela de histórico de aceites (por contrato). |

---

## Evitar erros

- **Identidade:** No portal, antes de enviar o cadastro, exibir linha do tipo: *"Você está aceitando o termo como: [Nome], CPF [valor], contato [telefone ou e-mail]. Confira se os dados estão corretos."* Assim o cliente (e o sistema) associam o aceite à pessoa certa.
- **CPF no cadastro:** Incluir campo CPF no completar cadastro (opcional ou obrigatório conforme política da clínica). Gravar normalizado (apenas dígitos) em `clients.cpf`. O termo impresso ou exibido pode usar esse CPF.
- **Por contrato (futuro):** Tabela `client_consent_records`: client_id, appointment_id (opcional), procedure_ids (array ou JSON), term_version, accepted_at, snapshot_dados (nome, cpf, email, phone). Assim cada aceite fica atrelado a um "contrato" (cadastro ou agendamento + procedimentos).
- **Procedimento certo:** Ao exibir cláusulas específicas, usar **sempre** os procedimentos do agendamento (ou do plano) em questão, nunca lista genérica — assim o termo se adapta ao que será realizado.

---

## O que já está no sistema

- **Termo geral** no portal (completar cadastro) com prestação de serviços, direito de imagem e menção ao termo completo na clínica.
- **Colunas em `clients`:** consent_terms_accepted_at, consent_image_use, consent_terms_version; `cpf` (já existe).
- **Procedimentos** com campo `termo_especifico` (cláusula por procedimento); formulário no dashboard para preencher.
- **Auditoria** ao completar cadastro (cliente X, aceite do termo, uso de imagem).

---

## Ordem sugerida de implementação

1. **Imediato (maturidade atual)**  
   - Incluir **CPF** no formulário de completar cadastro e na RPC `client_complete_registration`.  
   - No bloco do termo no portal, exibir o **resumo** "Você está aceitando como: [Nome], CPF [X], contato [Y]. Confira se está correto." (atualizado conforme o usuário preenche nome, CPF e contato).  
   - Assim o sistema já associa o aceite a nome, CPF e contato e reduz risco de erro de identidade.

2. **Próximo passo**  
   - No fluxo de **confirmação de agendamento** (link por e-mail/SMS): carregar appointment → cliente + procedimento(s).  
   - Exibir termo geral + cláusulas dos procedimentos que tenham `termo_especifico`.  
   - Resumo: nome do cliente, CPF, contato e **nome do(s) procedimento(s)**.  
   - Gravar aceite vinculado ao appointment (nova tabela ou campos em appointment_confirmations).

3. **Depois**  
   - Tabela `client_consent_records` para histórico de todos os aceites (cadastro + confirmações), com snapshot dos dados.  
   - No dashboard, ao registrar "aceite em papel", permitir informar procedimento(s) e versão do termo.  
   - Relatório ou tela "Termos aceitos" por cliente (data, versão, procedimentos, dados no momento).

---

## Resumo para a clínica

- **Cadastro:** Cliente preenche nome, CPF (recomendado), contato e aceita o termo; o sistema mostra "aceito como [dados]" para evitar confusão.  
- **Procedimento:** Cada procedimento pode ter cláusula específica; quando o atendimento for agendado, o termo exibido na confirmação inclui essas cláusulas.  
- **Contrato:** Cada aceite fica ligado a um contexto (cadastro ou agendamento + procedimentos) e aos dados do cliente naquele momento, dando respaldo jurídico e evitando erros de identidade ou de procedimento.
