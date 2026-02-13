# Melhorias sugeridas analisando o mercado

Com base no **comparativo com concorrentes** e na **análise de maturidade**, estas são melhorias que **fazem sentido** para subir as notas nas dimensões em que o mercado está à frente, **sem abandonar** o que nos diferencia (precificação real, protocolo, IA que sugere e não decide).

---

## 1. Onde o mercado está à frente (e podemos melhorar)

| Dimensão | Gap atual | Melhoria sugerida | Impacto na nota (estimado) |
|----------|-----------|-------------------|-----------------------------|
| **Agenda (70% → ~85%)** | Lembrete/confirmação automática; integração WhatsApp forte. | Lembretes e confirmação de agendamento (SMS ou WhatsApp quando houver integração); opção “enviar lembrete” manual por agendamento. | +10 a 15 pts |
| **Prontuário / anamnese (72% → ~82%)** | Mercado destaca fotos antes/depois e comparativo de evolução (ex.: GestãoDS, Amplimed). | Fotos no perfil do cliente (já existe suporte a foto); bloco “evolução do tratamento” com fotos por data/protocolo (antes/depois) no perfil ou na aba Protocolo. | +8 a 12 pts |
| **Notoriedade (25%)** | Marca, base, suporte. | Não é só produto: site, trial, depoimentos, parcerias. Documentação de suporte (FAQ, “como fazer”) e uma página “Para clínicas” ajudam. | — |

As demais dimensões (financeiro, precificação, protocolo, IA, portal, multi-org, estoque) já estão no mesmo nível ou acima do mercado; o foco é **não regredir** e, onde for caso, **comunicar melhor** o que já existe.

---

## 2. Melhorias priorizadas (esforço vs impacto)

### Alto impacto, esforço médio (fechar gap com mercado)

| # | Melhoria | O que fazer | Alinhado ao nosso modelo? |
|---|----------|-------------|----------------------------|
| 1 | **Lembrete / confirmação de agendamento** | Definir fluxo: X horas antes do horário, enviar link ou mensagem de confirmação (WhatsApp ou e-mail). Pode começar com “botão: Enviar lembrete” por agendamento; depois automatizar. | Sim. Reduz no-show; não mexe em precificação nem em “quem decide”. |
| 2 | **Fotos antes/depois e evolução no perfil do cliente** | Usar foto já existente no cliente; permitir associar fotos a “registro de protocolo aplicado” ou a datas. Exibir linha do tempo ou comparativo “antes / depois” por tratamento no perfil. | Sim. Reforça protocolo e registro do aplicado; não vira “só galeria solta”. |
| 3 | **Filtro de período no dashboard** | Garantir que o filtro Hoje/Semana/Mês altera métricas e gráficos (clientes, agenda, faturamento). Já citado em ANALISE-MATURIDADE. | Sim. Só amadurecer o que já está na UI. |

### Alto impacto, esforço menor (quick wins)

| # | Melhoria | O que fazer | Alinhado ao nosso modelo? |
|---|----------|-------------|----------------------------|
| 4 | **“Meu previsto hoje” (comissão %)** | Para profissional com remuneração por %: card no dashboard ou na agenda do dia com “previsto hoje” (procedimentos do dia × %). Sem expor valores de outros. | Sim. Conforme EQUIPE-CANONICO: registro, não execução. |
| 5 | **Relatório “procedimentos realizados” por período** | Relatório ou exportação: quantos procedimentos X realizados no período; por profissional (opcional). Dados já vêm da agenda/protocolo. | Sim. Informação para metas; não decisão automática. |
| 6 | **Contas a pagar → saída no financeiro** | Fluxo explícito: ao marcar conta como paga, gerar (ou sugerir) lançamento de saída no financeiro para não duplicar trabalho. | Sim. Já existe contas a pagar; só amadurecer o fluxo. |

### Médio impacto, manter coerência

| # | Melhoria | O que fazer | Alinhado ao nosso modelo? |
|---|----------|-------------|----------------------------|
| 7 | **Indicador de acurácia de estoque** | Comparar consumo previsto (protocolo) vs consumo real; meta ~85%; indicador ou tela simples. | Sim. Estoque como referência, não bloqueio. |
| 8 | **Documentação “Para clínicas” / FAQ** | Página ou doc: “Por que precificação com taxas?”, “O que é protocolo aplicado?”, “Como usar planos e margem”. Ajuda na notoriedade e na venda. | Sim. Reforça posicionamento. |

---

## 3. O que NÃO copiar do mercado (manter como está)

- Financeiro ou IA **sugerindo preço ou desconto** automaticamente → manter **só simulação**.
- Estoque **bloqueando** agendamento ou registro de protocolo → manter **alerta sim, bloqueio não**.
- Protocolo virar **só “pacote comercial”** → manter **plano (dor + valor)** e **protocolo (método + registro aplicado)** separados.
- Cliente ver resultado de IA **sem validação** → manter **clínica valida → cliente vê**.

---

## 4. Ordem sugerida (roadmap enxuto)

1. **Curto prazo (fechar gap visível)**  
   - Filtro de período no dashboard realmente aplicado às métricas.  
   - “Meu previsto hoje” para quem tem comissão %.  
   - Relatório de procedimentos realizados por período.  

2. **Médio prazo (agenda e prontuário)**  
   - Lembrete/confirmação de agendamento (mesmo que comece manual “Enviar lembrete”).  
   - Fotos antes/depois ou “evolução do tratamento” no perfil do cliente.  

3. **Continuidade**  
   - Contas a pagar → saída no financeiro.  
   - Acurácia de estoque (indicador).  
   - Conteúdo e FAQ para clínicas (notoriedade e posicionamento).  

---

## 5. Resumo

- **Sim, dá para melhorar** analisando o mercado: focar em **agenda** (lembrete/confirmação), **prontuário** (fotos/evolução) e **dashboard** (período e “previsto hoje”) sobe as notas nas dimensões em que estamos atrás e mantém os diferenciais.
- As melhorias listadas são **compatíveis** com o modelo do SkinClinic (limites entre módulos, IA que sugere, estoque que não bloqueia, protocolo aplicado).
- **Notoriedade** sobe com produto no ar + conteúdo + casos de uso, não só com feature; mas melhorar agenda e prontuário **reduz objeção** (“não tem lembrete”, “não tem antes/depois”) e facilita adoção.
