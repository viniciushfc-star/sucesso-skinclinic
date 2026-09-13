# Protocolo — Ideia amadurecida

Documento para fechar o conceito, priorizar escopo e guiar implementação sem quebrar o que já existe.

---

## Regras travadas (ordem de impacto)

| # | Regra | Resumo |
|---|--------|--------|
| 1 | **Discurso do botão Protocolo** | “**Método + histórico + viabilidade**”, nunca “promoção”. Em toda comunicação do módulo: método (como executar), histórico (estudo de caso), viabilidade (margem, simulação). Nunca oferta, campanha ou venda como propósito. |
| 2 | **Métricas de estudo de caso** | **No máximo 2–3 métricas.** Evitar virar BI confuso. Ex.: resposta observada, perfil (tipo de pele + queixa), opcionalmente volume. Definir e manter; não expandir sem critério. |
| 3 | **Desconto e parcelamento** | **Sempre simulação**, nunca sugestão automática. Usuário testa cenários; sistema mostra impacto (margem, limites). O sistema não sugere “dê X% de desconto” ou “parcele em Y vezes”. |

---

## 1. Plano vs Protocolo (distinção central)

| Conceito | O que é | Onde vive no app |
|----------|---------|-------------------|
| **Plano** | **Conjunto de procedimentos** — quais procedimentos compõem a resposta à dor do cliente (e, no app, os **valores de venda**: preço, forma de cobrança, oferta). | Botão **Plano** — planos terapêuticos, valores, apresentação comercial. |
| **Protocolo** | **O que é feito dentro do procedimento** — passos, produtos aplicados, técnica, registro do que foi efetivamente aplicado no paciente. | Botão **Protocolo** — método clínico + registro do que foi aplicado (proteção da empresa). |

**Protocolo e planos de procedimentos andam juntos:** são **dois botões que se conversam**, não uma coisa única.

- **Plano** = “quais procedimentos, em que ordem, por que valor”.
- **Protocolo** = “como executar cada procedimento” e “o que foi aplicado nesta sessão / neste paciente”.

---

## 2. Papel do Protocolo: proteger a empresa + entrada fácil

O protocolo é uma forma de **prevenir a empresa** com **o que foi aplicado no paciente**:

- Registro claro do que foi feito (produtos, técnica, observações).
- Rastreabilidade e continuidade de cuidado.
- Base para estudo de casos (anonimizado) e melhoria contínua.

**Condição crítica:** a entrada de dados tem que ser **fácil e rápida**, para:

- não ocupar tanto o tempo do profissional;
- não ficar sem preencher — dependendo da clínica, o fluxo de atendimento já pode ser exaustivo; mais uma tarefa pesada faz o profissional pular o preenchimento.

📌 **Protocolo só cumpre o papel se for rápido de preencher.** Caso contrário, vira “mais uma tarefa” e fica em branco.

---

## 2.1 Onde o protocolo vive: aba do cliente + atalho da agenda + protocolos do dia

- **Protocolo dentro da aba do cliente:** como a agenda já deixa mais simples procurar o cliente, o registro do que foi aplicado fica **na aba do cliente** (perfil do cliente). Fluxo: agenda → acha o cliente → abre o cliente → na aba do cliente, preenche o protocolo (o que foi aplicado). Não vira um fluxo separado e pesado.
- **Atalho da agenda (recomendado):** a partir do **atendimento na agenda**, permitir abrir direto "Registrar o que foi aplicado" (protocolo desta sessão) **sem** precisar abrir o perfil inteiro do cliente. Assim fica ainda mais rápido: agenda → clica no atendimento → registra protocolo.
- **Cruzamento: protocolos do dia:** visão que cruza **todos os protocolos gerados no dia** — onde: **agenda** (filtro "hoje" + aba/resumo do dia) ou **dashboard** (bloco "Protocolos hoje"). Ver o que foi aplicado, em quem, e cruzar com estoque e histórico.

---

## 2.2 Estoque vê pelo protocolo o que foi usado

- O **estoque** vê pelo protocolo o que foi usado em cada protocolo.
- **Assume que os descartáveis também foram usados:** o sistema entende o que cada protocolo usa de descartáveis (cadastro por protocolo) e, ao registrar que o protocolo foi aplicado, **assume** o consumo dos descartáveis daquele protocolo. Isso ajuda na **análise do estoque** sem exigir que o profissional registre item a item.
- **Histórico para acurácia (meta 85%):** a acurácia é medida comparando **previsão de consumo** (o que o protocolo indica) com **consumo real** (o que foi registrado ou ajustado no estoque). Com o tempo, o histórico refina a relação protocolo ↔ consumo; a meta é a previsão ficar **no mínimo 85% acertiva** (ex.: em 100 aplicações do protocolo X, o consumo real de itens Y/Z está dentro de 85% do previsto).
- **Estoque e protocolo:** opcionalmente, ao registrar que um protocolo foi aplicado, o sistema pode **alertar** se algum descartável daquele protocolo estiver em estoque baixo ou zerado — para a clínica repor ou ajustar, sem bloquear o registro.

---

## 3. Conceito fechado (em uma frase) — discurso travado

**Protocolo = método + histórico + viabilidade.** Nunca promoção.

**Frase oficial (travar em toda comunicação do botão Protocolo):**  
*“O botão Protocolo é sobre **método** (como executar), **histórico** (o que funcionou, estudo de caso) e **viabilidade** (margem, custo, simulação). Nunca sobre promoção, oferta ou venda.”*

- **Não é:** oferta, preço, promessa, módulo de venda, gerador de promoções, campanha comercial.
- **É:** método organizado, **registro rápido do que foi aplicado**, explicável e sustentável; o sistema **informa**, o humano **decide**.

---

## 4. As 3 dimensões (o que cada uma entrega)

| Dimensão | Entrega para a clínica | Exemplo de uso |
|----------|------------------------|----------------|
| **Clínica** | “Como tratar” — objetivo, perfil, sequência de procedimentos, frequência, skincare, observações. | “Para essa queixa e esse tipo de pele, este protocolo indica: limpeza → peeling → hidratação, 1x/semana, 6 sessões.” |
| **Histórica** | “O que funcionou melhor” — casos anonimizados ligados ao protocolo (perfil, queixa, resposta). | “Em perfis semelhantes, este protocolo teve melhor resposta em X% dos casos. Tendência, não garantia.” |
| **Financeira** | “Como sustentar” — custo médio, margem planejada, **sempre simulação** de desconto/parcelamento (nunca sugestão automática). | “Até 3x mantém margem mínima. Com 10% de desconto à vista, a margem cai para Y%.” |

Nenhuma dimensão **substitui** a decisão do profissional; todas **apoiam** a decisão.

**Regra travada — Desconto e parcelamento:**  
Desconto e parcelamento são **sempre simulação** (o usuário escolhe cenários e vê o impacto). O sistema **nunca** sugere automaticamente “dê X% de desconto” ou “parcele em Y vezes”. Simulação = informar; sugestão automática = proibido.

---

## 5. Custo e preço: triangulação (Plano + dados externos)

O **custo do procedimento** e o **custo do plano** não vêm de uma única fonte. São uma **triangulação**:

- **Dados externos:** internet, região, concorrentes (benchmark de preço e posicionamento).
- **Meus custos:** valor do **material usado** (estoque por procedimento), **custo fixo** (estrutura, espaço, equipamento), **valor da mão de obra** (tempo, profissional).

Isso conversa mais com o **Plano** (valores de venda do app). O **Protocolo** usa custo/consumo para margem e simulação quando fizer sentido. **Dois botões que se conversam.**

---

## 6. O que já existe no sistema (não quebrar)

- **API/Protocolo:** gera rascunho via IA (procedimentos, cronograma, cuidados, tempo). Não persiste como “protocolo” único; não tem custo nem casos.
- **Planos terapêuticos:** `planos_terapeuticos` + `planos_terapeuticos_procedimentos` — dor do cliente, explicação terapêutica, vínculo com procedimentos.
- **Procedimentos, Agenda, Estoque, Financeiro:** fontes de dados para custo, tempo e consumo.

**Princípio:** Protocolo **conecta** esses módulos; não duplica nem substitui. Um protocolo pode **gerar** ou **alimentar** um plano; plano é “como apresentar ao cliente”, protocolo é “como tratar”.

---

## 7. Escopo por camada (sugestão de amadurecimento)

### Camada 1 — Estrutura clínica do protocolo (base)

**Objetivo:** Ter “protocolo” como entidade clara: objetivo, perfil, sequência de procedimentos, frequência, observações.

- Cadastro de **protocolos** (nome, objetivo clínico, perfil de pele/queixa, observações).
- **Sequência:** protocolo ↔ procedimentos (ordem, quantidade de sessões, intervalo).
- Relação opcional com **skincare** (texto ou referência).
- **Não** inclui ainda: preço, custo, casos.

**Resultado:** A clínica passa a ter “receitas de cuidado” reutilizáveis e vinculadas aos procedimentos já cadastrados. A IA atual pode continuar **sugerindo** um rascunho que o profissional grava como protocolo.

---

### Camada 2 — Dimensão financeira (custo e margem)

**Objetivo:** Saber custo do protocolo e margem, e **simular** desconto/parcelamento **sem** decidir preço.

**Regra travada:** Desconto e parcelamento são **sempre simulação**. O usuário escolhe cenários (ex.: “e se der 10% à vista?” “e se parcelar em 3x?”) e vê o impacto (margem, limite). O sistema **nunca** sugere automaticamente “dê X% de desconto” ou “parcele em Y vezes”.

- **Custo médio do protocolo:**  
  - tempo de agenda (soma da duração dos procedimentos),  
  - consumo de estoque (itens vinculados aos procedimentos),  
  - custo operacional (se houver regra por procedimento ou por tempo).
- **Margem planejada:** meta de margem % (configurável por protocolo ou global).
- **Simulador (apenas simulação):**  
  - preço de referência (ex.: soma dos preços dos procedimentos ou valor do plano),  
  - usuário testa: desconto à vista → margem resultante; parcelamento em X vezes + taxas → margem resultante.  
  Exibir: “Até X parcelas mantém margem mínima”; “Com Y% de desconto, margem vai a Z%.”  
  **Não** exibir sugestões do tipo “recomendamos 5% de desconto”.

**Limite:** O sistema **não** define preço final, **não** gera oferta, **não** sugere desconto/parcelamento; só mostra cenários e limites quando o usuário simula.

---

### Camada 3 — Estudo de casos (inteligência histórica)

**Objetivo:** Associar casos reais (anonimizados) aos protocolos para “o que funcionou melhor”.

**Regra travada — Métricas de estudo de caso:**  
Usar **no máximo 2–3 métricas** para estudo de caso. Evitar virar BI confuso (dezenas de indicadores, dashboards pesados). Sugestão de foco: (1) **resposta observada** (ex.: melhora / sem mudança / efeito adverso), (2) **perfil** (tipo de pele + queixa principal), (3) opcionalmente **volume** (ex.: N sessões ou adesão). Definir 2–3 e manter; não expandir sem critério.

- **Registro de caso:**  
  - vinculado a um **protocolo** (ou plano derivado dele),  
  - dados **anonimizados:** tipo de pele, queixa principal, resposta observada (ex.: melhora, sem mudança, efeito adverso), data.
- **Agregação:** por protocolo, por perfil (tipo de pele + queixa), contar/percentual de respostas — **sempre com as 2–3 métricas escolhidas**, sem abrir exceção para “só mais um indicador”.
- **Uso:**  
  - na tela do protocolo: “Para perfis semelhantes, este protocolo teve melhor resposta em N% dos casos.”  
  - no Copilot: explicar tendências, **nunca** garantir resultado nem definir conduta.

**Limite:** Não é before/after de marketing; não vira argumento clínico automático. **IA explica tendência, não define conduta.**

---

## 8. Ordem sugerida de implementação

1. **Camada 1** — Estrutura clínica (tabelas de protocolo + protocolo_procedimentos, tela de cadastro/edição, integração opcional com o “gerar protocolo” da IA).
2. **Camada 2** — Custo + margem + simulador (usar procedimentos, estoque e financeiro existentes; não criar módulo comercial).
3. **Camada 3** — Casos anonimizados + agregação + frase de tendência na tela do protocolo e no Copilot.

Cada camada pode ser entregue e usada sem depender da seguinte; a ordem evita “promessa” antes de ter método e evita “preço” antes de ter custo.

---

## 6. Relação com outros módulos (resumo)

| Módulo | Relação com Protocolo |
|--------|------------------------|
| **Anamnese** | Protocolo **só é aplicado após** anamnese; pode ser adaptado caso a caso; nunca imposto automaticamente. |
| **Planos** | Protocolo = “como tratar”; Plano = “como apresentar ao cliente”. Planos podem **nascer** de protocolos. |
| **Procedimentos** | Protocolo é uma **sequência** de procedimentos já cadastrados (ordem, sessões, intervalo). |
| **Agenda / Estoque** | Fontes para **cálculo de custo** (tempo, consumo). |
| **Financeiro** | Margem, simulação de pagamento; **informa**, não decide. |
| **Copilot** | Pode explicar dados, resumir casos, mostrar tendências, alertar risco financeiro; **nunca** criar protocolo sozinho nem definir preço. |

---

## 7. Riscos e “não fazer”

- **Não** transformar o botão Protocolo em módulo de venda ou gerador de ofertas. **Discurso travado: método + histórico + viabilidade; nunca promoção.**
- **Não** usar estudo de casos como garantia de resultado ou argumento de venda automático.
- **Não** deixar a IA definir preço final ou conduta clínica.
- **Não** sugerir automaticamente desconto ou parcelamento — só **simulação** (usuário testa cenários; sistema mostra impacto).
- **Não** multiplicar métricas de estudo de caso — **máximo 2–3**; evitar virar BI confuso.
- **Não** refatorar em bloco Anamnese, Planos, Procedimentos, Financeiro; **integrar** sem substituir.
- **Não** exibir dados de casos sem anonimização (nem para staff; agregado e anonimizado só).
- **Não** fazer do protocolo um formulário longo que o profissional não tenha tempo de preencher — **entrada fácil** é condição de uso.

---

## 11. Perguntas para fechar antes de codar

- **Protocolo vs plano:** Um plano **sempre** nasce de um protocolo, ou pode existir plano “solto” e protocolo “solto”? (Sugestão: protocolo pode existir sem plano; plano pode referenciar um protocolo.)
- **Custo do protocolo:** Custo do procedimento vem de onde? (Tabela de procedimentos com custo? Financeiro? Estoque médio por procedimento?)
- **Margem mínima:** Definida por organização, por protocolo ou ambos? (Sugestão: global por org + opcional por protocolo.)
- **Quem vê o botão Protocolo:** Só direção/coordenador ou também terapeutas? (Canon diz: técnico, pode ser restrito.)
- **Casos:** Quem registra “resposta observada”? Profissional no pós-atendimento? Em qual tela (perfil do cliente, anamnese, outro)?

---

## 9. Frases-guia (manter em qualquer implementação)

- *“Protocolo organiza o cuidado.”*
- *“Histórico orienta, não garante.”*
- *“Margem protege a clínica.”*
- *“O sistema informa, o humano decide.”*
- *“Este módulo existe para transformar experiência em método.”*

---

## 10. Próximo passo sugerido

Definir com produto/clínica as respostas da **seção 8**; em seguida, desenhar o **modelo de dados da Camada 1** (tabelas `protocolos` e `protocolos_procedimentos`, ou reaproveitar/estender `planos_terapeuticos` se fizer sentido) e a **tela mínima** do botão Protocolo (listar, criar, editar, sequência de procedimentos), sem ainda custo nem casos.

Assim a ideia fica madura o suficiente para implementar por etapas, sem quebrar o conceito original do botão Protocolo.
