# Procedimentos — especificação (transcrição fiel)

Frase-guia: **“Procedimento não é só tempo e lucro — é custo real, operação e decisão consciente.”**

---

## Finalidade da aba PROCEDIMENTOS

- Centralizar todos os serviços oferecidos pela clínica
- Definir **tempo**, **valor** e **custo real** de cada procedimento
- Ajudar na precificação correta (variáveis que costumam ser esquecidas)
- Conectar procedimentos ao **estoque**
- Gerar **métricas reais**, não estimativas vagas
- Dar **suporte à decisão humana**, não substituí-la
- Entrar em **finanças** para mostrar o que de fato entra como **lucro**, o que é **custo operacional** e o que é **pagamento para funcionário**; depois, na parte de metas, ajudar a ter **metas reais**

---

## O que é um procedimento no sistema

- Um serviço executado pela clínica
- Que ocupa tempo na agenda
- Que consome recursos
- Que gera receita
- Que impacta estoque
- Que impacta métricas

**Não é:** apenas nome, apenas preço fixo, apenas bloco de tempo.

---

## Dados de um procedimento (mínimo)

| Campo | Uso |
|-------|-----|
| **Identificação** | Nome, descrição |
| **Tempo** | Duração média; base para agenda |
| **Valor** | Valor final cobrado; métrica; passível de revisão |
| **Precificação** | IA apoia (tempo, aluguel rateado, luz, material, custos operacionais, margem); não define sozinha |
| **Estoque** | Itens normalmente usados + quantidade média; baixa estimada como referência, não verdade absoluta |
| **Finanças** | Entra em finanças: lucro real, custo operacional, pagamento funcionário → depois metas plausíveis |

---

## Precificação (IA apoia, não decide)

- Variáveis: tempo, hora do aluguel (rateada), luz, quantidade de material, custos operacionais, margem desejada
- IA: sugere, simula, explica; ajuda a ver custos ocultos, cruzamentos, alertas de subprecificação; **não decide**
- Nada automático sem validação humana

---

## Procedimento ↔ Estoque

- Cada procedimento pode ter: itens de estoque normalmente usados + quantidade média por procedimento
- Quando o procedimento é realizado: baixa **estimada** no estoque (referência)
- Na conferência de estoque: mostrar o esperado vs. o que está faltando; permitir correção humana
- O sistema **não bloqueia** por divergência; oferece norte, estimativa, ponto de comparação

---

## Procedimento ↔ Finanças

- O procedimento entra em **finanças** para mostrar:
  - O que de fato está entrando como **lucro**
  - O que é **custo operacional**
  - O que é **pagamento para funcionário**
- Posteriormente, na parte de **metas**, isso ajuda a ter **metas reais** (plausíveis)

---

## Relação com outras partes

- **Agenda** — tempo e tipo de serviço
- **Cliente** — procedimento realizado
- **Estoque** — consumo estimado
- **Métricas** — rentabilidade real
- **Precificação** — decisão estratégica (IA apoia)
- **Finanças** — lucro, custo, pagamento; base para metas

---

## O que a aba NÃO faz (por design)

- Não precifica automaticamente
- Não altera estoque real sem conferência
- Não decide margem sozinha
- Não cria procedimentos sozinha
- Não substitui a análise do gestor

---

## Critério de qualidade

A funcionalidade está correta se:

1. A precificação considerar mais do que tempo e material direto
2. O estoque tiver referência por procedimento
3. A IA apoiar, não decidir
4. Nada for automático sem validação humana
5. O sistema trouxer clareza, não complexidade cega
6. O procedimento estiver ligado a finanças (lucro, custo, pagamento) e, no futuro, a metas reais

---

*Este documento é uma transcrição fiel das ideias discutidas, não uma proposta de novas funcionalidades.*
