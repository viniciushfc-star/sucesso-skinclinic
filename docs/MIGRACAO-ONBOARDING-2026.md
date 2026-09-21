# Migração e onboarding — 2026

## O que já existe

**Onboarding:** `onboarding.html` — nome da clínica (`org.service`). Sem profissionais, procedimentos, custos, metas.

**Importação (estratégica, subcomunicada):** `js/services/importacao-lote.service.js`  
- CSV `;` ou `,`; header flexível; máx. **2000** linhas.  
- Clientes (CPF/e-mail duplicado ignorado).  
- Procedimentos (nome duplicado opcional).  
- Financeiro e **custo fixo** (`origem_importacao`).  
- Agenda (insert `agenda`).  
UI: rota `#export` (`export.views.js` — “Exportar e importar”).

**Não é** o pipeline IA: sem Excel nativo, sem mapa de colunas assistido, sem prévia linha a linha obrigatória, sem rollback transacional, sem relatório persistido.

**Duplicados:** CPF no cadastro manual (`clientes.service.js`).

## Conceito alvo (P1 refinar CSV; P2 IA)

```
ARQUIVO → (opcional IA interpreta) → MAPA COLUNAS → NORMALIZA
→ DUPLICADOS → VALIDA → PRÉVIA → CONFIRMA → IMPORTA → RELATÓRIO
```

Rollback: lote `import_batch_id` nas linhas inseridas. Sem isso, rollback é delete manual.

## Setup Progress (P1)

Checklist persistido na org:

1. Empresa (nome, cidade)  
2. 1 profissional  
3. 1 procedimento com duração e preço  
4. 1 custo material ou item de estoque  
5. Importar ou cadastrar 1 cliente  
6. 1 horário na agenda  
7. (opcional) meta do mês  

UI: “87% configurado” no Hoje até 100%. Momento aha: primeiro **protocolo aplicado**.

## Por que é diferencial de retenção SaaS

Clínica não abandona na semana 1 se a agenda antiga entra. Commodity de agenda **não** resolve isso bem. Completar CSV é P1 de time-to-value — **antes** de Intelligence.
