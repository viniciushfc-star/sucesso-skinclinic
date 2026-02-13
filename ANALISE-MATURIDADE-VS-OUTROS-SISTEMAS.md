# Análise: maturidade do Projeto Sucesso vs outros sistemas

Documento para comparar o que temos com padrões de sistemas do segmento (clínicas, estética, gestão de prática) e ver o que faz sentido implementar ou amadurecer.

---

## 1. Onde a nossa ideia está mais madura

### 1.1 Limites claros por módulo

Em muitos sistemas, **Financeiro** vira “tudo que é dinheiro” e engole precificação, comissão e metas de forma confusa. Aqui está definido:

| Nossa regra | Outros sistemas (comum) | Por que faz sentido manter |
|-------------|-------------------------|----------------------------|
| **Precificação mora em Procedimentos**; Financeiro só consolida e cruza. | Precificação espalhada (planos, financeiro, procedimentos). | Uma única fonte de verdade; simulações e metas usam os mesmos números. |
| **Financeiro não decide**; usuário simula e confirma. | Sugestões automáticas de desconto, “dê X% off”. | Evita decisão automática que não reflete a realidade da clínica. |
| **Estoque como referência** (meta ~85% acertiva), não punição. | Estoque como controle rígido; bloqueia atendimento se “zerar”. | Clínica não para por bug de cadastro; divergência vira informação. |

**Conclusão:** Manter esses limites. Não importar do outro sistema a ideia de “financeiro que sugere preço” ou “estoque que trava atendimento”.

---

### 1.2 Protocolo vs Plano (dois conceitos separados)

Outros sistemas costumam misturar:

- “Protocolo” = pacote comercial (conjunto de sessões + preço).
- “O que foi aplicado no paciente” = anotações soltas ou nem existe.

Aqui está separado:

- **Plano** = resposta à dor do cliente (quais procedimentos, em que ordem, valor).
- **Protocolo** = método + **registro do que foi aplicado** (proteção + estoque + estudo de caso).

**Conclusão:** Manter. O registro “o que foi aplicado” com vínculo a protocolo + estoque + estudo de caso é mais maduro que a maioria dos sistemas de estética. Não colapsar em “só um tipo de protocolo comercial”.

---

### 1.3 Papel da IA (apoia, não decide)

Documentos e regras travadas deixam claro:

- Precificação: IA sugere; humano confirma.
- Desconto/parcelamento: sempre **simulação**, nunca “sugira X%”.
- Estudo de caso: métricas limitadas (2–3); não virar BI genérico.

Em outros sistemas é comum “IA recomenda desconto” ou dashboards com dezenas de métricas sem foco.

**Conclusão:** Manter. Se for copiar algo de outro sistema, não copiar “recomendações automáticas de preço ou desconto”.

---

### 1.4 Equipe e pagamento (registro, não execução)

Equipe canônico deixa claro:

- Sistema **registra** modelo de pagamento (fixo, %, diária, combinado) e **usa para análise**.
- Sistema **não executa** pagamento nem vira folha.
- Visibilidade restrita (quem pode ver valores).

Muitos sistemas ou não modelam isso, ou tentam virar “folha de pagamento” e ficam pela metade.

**Conclusão:** Manter. Não puxar do outro sistema “módulo de folha” se a ideia aqui é só registro e impacto em métricas.

---

### 1.5 Portal do cliente (token, validação, continuidade)

Fluxo atual:

- Acesso por **token** (sem login tradicional).
- Análise de pele: cliente envia → **clínica valida** → cliente vê resultado.
- Rotina skincare: clínica libera quando fizer sentido.

Em outros sistemas é comum: cliente vê tudo que “a IA disse” sem validação, ou não há noção de “liberar quando fizer sentido”.

**Conclusão:** Manter. A clínica ter a palavra final (validação, liberação) é mais maduro para uso real.

---

## 2. O que outros sistemas costumam ter e pode fazer sentido (se alinhado ao nosso)

| Recurso comum em outros | Nosso estado | Aplicar aqui? | Motivo |
|-------------------------|--------------|--------------|--------|
| **Lembretes / confirmação de agendamento** (SMS/WhatsApp) | Parcial (notificações, WhatsApp em alguns fluxos). | Sim, amadurecer. | Reduz no-show; não muda conceito de agenda nem de financeiro. |
| **Filtro de período no dashboard** (hoje / semana / mês) | Ideia em DASHBOARD-PERMISSOES; filtro existe na UI, conexão com métricas pode estar incompleta. | Sim. | Já está no doc; só garantir que métricas e gráficos respeitam o período. |
| **“Meu previsto hoje” (comissão %)** | Ideia em DASHBOARD-PERMISSOES. | Sim, se o modelo de pagamento já tiver %. | Apoia o profissional remunerado por %; não decide nada sozinho. |
| **Relatório de procedimentos realizados por período** | Agenda tem dados; relatório “quantos X realizados em Y” pode não estar centralizado. | Sim. | Alimenta metas e visão “o que foi feito”; continua sendo informação, não decisão. |
| **Contas a pagar com vencimento** | Existe (contas_a_pagar); integração com “quando pago vira saída” pode ser manual. | Já temos; só amadurecer fluxo. | Não importar outro conceito; só deixar o nosso mais claro (ex.: “paguei → vira saída no financeiro”). |
| **Assinatura / recorrência (mensalidade)** | Não como conceito primeiro. | Avaliar com cuidado. | Se fizer sentido para o negócio, modelar como “compromisso recorrente” e alimentar financeiro/agenda; sem virar “sistema de cobrança automática” se não for o foco. |

---

## 3. O que outros têm e tende a NÃO se aplicar (ou aplicar com cuidado)

| Recurso comum | Por que não copiar direto |
|---------------|---------------------------|
| **Financeiro que “sugere preço” ou “recomenda desconto”** | Regra travada: simulação sim, sugestão automática não. |
| **Estoque que bloqueia agendamento ou registro de protocolo** | Nossa ideia: alerta sim, bloqueio não; acurácia como meta, não como trava. |
| **Módulo de folha de pagamento completo** | Equipe canônico: registrar modelo e impacto; não executar pagamento. |
| **Dezenas de métricas / BI genérico no estudo de caso** | Manter 2–3 métricas; evitar BI confuso. |
| **Protocolo = só “pacote comercial”** | Manter Plano (comercial) + Protocolo (método + registro aplicado). |
| **Cliente vê resultado de IA sem validação** | Manter “clínica valida → cliente vê”. |

---

## 4. O que amadurecer dentro do que já temos

- **Dashboard e período**  
  Garantir que filtro Hoje/Semana/Mês altera de fato as métricas e os gráficos (conforme DASHBOARD-PERMISSOES).

- **“Meu previsto hoje”**  
  Para quem tem remuneração por %: card com “previsto hoje” (procedimentos do dia × %), sem expor outros valores (conforme EQUIPE-CANONICO).

- **Relatório “procedimentos realizados”**  
  Por período, por profissional (opcional), por procedimento; usado para metas e visão operacional, sem virar BI infinito.

- **Contas a pagar → saída no financeiro**  
  Fluxo explícito: marcar conta como paga → gera (ou sugere) lançamento de saída no financeiro, para não duplicar trabalho.

- **Acurácia de estoque**  
  Comparar previsão (protocolo) vs consumo real; meta ~85%; relatório ou indicador simples (já citado em PROTOCOLO e APP-VISAO-GERAL).

- **Importação / onboarding**  
  Já evoluído (import por módulo, backup único, opção de duplicados, preview). Manter e só refinando mensagens e limites (ex.: 2000 linhas).

---

## 5. Resumo

| Aspecto | Conclusão |
|--------|-----------|
| **Onde somos mais maduros** | Limites entre Financeiro / Procedimentos / Estoque; Protocolo vs Plano; IA que apoia e não decide; equipe como registro; portal com validação. |
| **O que adotar de outros** | Lembretes/confirmação, filtro de período no dashboard, “meu previsto hoje”, relatório de realizados, amadurecer contas a pagar → financeiro. |
| **O que não copiar** | Financeiro/IA sugerindo preço ou desconto; estoque bloqueando; folha completa; BI confuso; protocolo só comercial; cliente vendo IA sem validação. |
| **O que amadurecer no nosso** | Período no dashboard, “previsto hoje”, relatório de realizados, fluxo contas a pagar → saída, acurácia de estoque. |

Assim dá para olhar outro sistema e decidir: “isso entra no nosso modelo de limites e regras ou não?” — e priorizar o que realmente se aplica.
