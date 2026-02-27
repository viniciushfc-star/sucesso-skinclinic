# Análise de concorrentes e diferenciais — SkinClinic

Documento para apoiar decisões de produto: **o que concorrentes fazem bem**, **o que podemos implementar** e **o que já temos de forte**.  
*(Referência genérica a sistemas de gestão para clínicas/estética; ajuste com os nomes dos apps que você considerar concorrentes.)*

---

## 1. O que costuma ser forte nos concorrentes

### Agendamento e experiência do cliente
- **Agendamento online pelo cliente** (escolher horário, profissional, procedimento) sem depender da recepção.
- **Lembretes automáticos** por WhatsApp/SMS no dia anterior.
- **Confirmação em um clique** (link no lembrete) e reconfirmação antes do horário.
- **Lista de espera** quando não há vaga; aviso quando abrir horário.
- **App para o cliente** (celular) para ver agendamentos, histórico e mensagens.

### Financeiro e operação
- **Integração com maquininha** (PagSeguro, Stone etc.): puxar transações e conciliar.
- **Cobrança recorrente** (assinaturas, mensalidades) e **boleto/cartão salvos**.
- **NF-e integrada** (emissão direta ou link para prefeitura/contador).
- **Relatórios prontos** para contador (DRE simplificado, por período).

### Marketing e fidelização
- **Campanhas de WhatsApp** em massa (envio em lote para segmentos).
- **Cupons e promoções** com código; controle de uso.
- **Programa de fidelidade** (pontos, descontos na Nª sessão).
- **Pesquisa de satisfação** pós-atendimento (NPS) com resultado por profissional.

### Gestão da clínica
- **Múltiplas unidades** com visão consolidada e por filial.
- **Comissão automática** por procedimento (cálculo e relatório por profissional).
- **Controle de estoque** com alerta de estoque mínimo e custo por procedimento.
- **Prontuário eletrônico** completo (anamnese, evolução, fotos, receitas).

### Usabilidade e suporte
- **Onboarding guiado** (primeiro acesso com passo a passo).
- **Chat/suporte** dentro do sistema.
- **Tutoriais em vídeo** e base de conhecimento.
- **App nativo** (iOS/Android) para a equipe.

---

## 2. O que podemos implementar (priorizado)

| Prioridade | O que implementar | Benefício |
|------------|-------------------|-----------|
| **Alta** | Agendamento online pelo cliente (portal com escolha de data/hora/profissional) | Menos ligações, menos falha de comparecimento, diferencial na experiência |
| **Alta** | Lembretes automáticos (WhatsApp/e-mail) no dia anterior + link de confirmação | Já temos modelo de mensagem e envio pontual; automatizar reduz no-show |
| **Alta** | Pesquisa de satisfação pós-atendimento (NPS ou nota) vinculada ao profissional | Dados para “o que temos de forte” (desempenho, avaliação) e melhoria contínua |
| **Média** | Integração com maquininha (importar transações e sugerir conciliação) | Menos digitação no financeiro e menos erro |
| **Média** | Lista de espera + aviso quando abrir vaga | Aproveita demanda que hoje se perde |
| **Média** | Campanhas de WhatsApp em lote (segmento por procedimento, última visita etc.) | Marketing mais dirigido com base nos dados que já temos |
| **Média** | App para o cliente (PWA ou nativo) para ver agendamentos e histórico | Sensação de “minha clínica tem app” |
| **Baixa** | Múltiplas unidades com dashboard consolidado | Para redes; hoje já temos multi-org |
| **Baixa** | Cupons e promoções com código | Útil para campanhas pontuais |

---

## 3. O que já temos de forte em relação aos concorrentes

### Foco em estética e cuidado com a pele
- **Skincare com IA**: geração de rotina a partir de análise/contexto; rotina liberada no portal; afazer automático ao salvar (tarefa do dia na agenda sem ocupar horário).
- **Análise de pele por IA** (portal): cliente envia fotos e respostas; IA gera preliminar; clínica valida e incorpora à anamnese — **clínica mantém a palavra final**.
- **Protocolo como método**: registro do que foi aplicado no atendimento, consumo de estoque por protocolo, estudo de caso anonimizado e perguntas à IA (diferencial de conhecimento, não só agendamento + caixa).

### Precificação e margem real
- **Taxas reais da maquininha** (por bandeira e forma de pagamento) e **simulador de recebimento** (quanto sobra em cada forma).
- **Precificação dos procedimentos** com margem e custo; apoio à precificação com IA.
- **Planos terapêuticos** (pacotes/assinaturas) com simulador de receita.

### Equipe e desempenho (sem virar “painel de comissão”)
- **Equipe com função** (staff = função do profissional); **desempenho por profissional**: faturamento (30 dias) e tarefas concluídas.
- **Forma de pagamento da equipe** (fixo, comissão, diária, combinado) com **nome do responsável** (não ID), só para análise.
- **Afazeres** com prazo e responsável; **tarefas do dia na agenda** (visível no dia, sem ocupar horário); afazer automático ao salvar rotina skincare.

### Agenda e fluxo do dia
- **Tarefas do dia na agenda**: afazeres com prazo na data aparecem no dia (lembrete), sem bloquear horário.
- **Integração Google Agenda** por profissional (blocos de indisponibilidade).
- **Salas e procedimentos por sala**; **modelo de agendamento** (desconto) e **retorno** (não gera receita).
- **Dar baixa** no agendamento (financeiro vinculado); resumo do fluxo do cliente (anterior / hoje / próximo).

### Cliente e continuidade do cuidado
- **Perfil do cliente** rico: dados, histórico, protocolo aplicado, rotina skincare, evolução (fotos), anamnese.
- **Portal do cliente** (link por sessão, sem login): confirmação de agendamento, análise de pele, rotina skincare liberada, documentos.
- **Documentos e termos** (modelos para clínica de estética): consentimento, imagem, LGPD, cancelamento etc.

### Operação e controle
- **Estoque** com entradas (manual, OCR, XML), consumo estimado por protocolo, alerta de falta no registro de protocolo.
- **Financeiro** com entradas/saídas, categorias, custo fixo, simulador por forma de pagamento; **relatório para o contador** (resumido por cliente e totais).
- **Exportar/importar** (CSV) e **backup/restauração** (JSON); **auditoria** de ações da equipe.
- **Multi-organização** (cada clínica é uma org); **permissões por tela** (clientes, agenda, financeiro etc.).

### IA e posicionamento
- **Copiloto**: perguntas sobre dados e indicadores da clínica com resposta baseada no sistema.
- **Marketing**: sugestões de conteúdo e métricas com base em cidade e procedimentos cadastrados.
- **Estudo de caso**: casos anonimizados por protocolo, perguntas pertinentes e “esclarecer dúvida após leitura” (IA).
- **“Para clínicas”**: ajuda e posicionamento (conteúdo).

---

## 4. Resumo em uma frase

- **Concorrentes:** fortes em agendamento online pelo cliente, lembretes automáticos, integração com maquininha, app para cliente e múltiplas unidades.
- **Podemos implementar:** agendamento online + lembretes automáticos + pesquisa de satisfação (NPS) em prioridade alta; depois integração maquininha, lista de espera e campanhas WhatsApp.
- **Nosso forte:** skincare e análise de pele com IA (com validação da clínica), protocolo como método com estudo de caso, precificação com margem real e taxas da maquininha, equipe com desempenho e tarefas do dia na agenda, e portal do cliente com rotina e análise — tudo com foco em **estética e cuidado com a pele**, não só agenda + caixa.

---

*Atualize este documento quando definir concorrentes específicos (nome do app, site) e quando implementar ou descartar itens da lista “o que podemos implementar”.*
