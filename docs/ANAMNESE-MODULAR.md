# Anamnese modular — arquitetura e uso

Sistema de anamnese em três tipos por risco, com motor de regras, score, antropometria e integração com análise de pele (skincare).

---

## 1. Tipos de anamnese

| Tipo         | Risco  | Uso |
|-------------|--------|-----|
| **injetaveis** | Alto   | Toxina, preenchimento, bioestimulador. Exige contraindicações e bloqueio automático. |
| **corporal**   | Médio  | Antropometria + bioimpedância (IMC, RCQ, waist/height, classificação metabólica). Histórico versionado e comparação evolutiva. |
| **simples**    | Baixo  | Limpeza de pele, peelings superficiais. Ficha mais enxuta. |

O vínculo **função → tipo** fica em `anamnesis_funcao_tipo` (por org). Na falta de vínculo, o app pode inferir por slug: `rosto_injetaveis` → injetaveis, `corporal` → corporal, `rosto_pele`/`capilar` → simples.

---

## 2. Estrutura das regras em JSON

Cada linha em `anamnesis_regras` tem:

- **nivel**: `contraindicacao_absoluta` | `contraindicacao_relativa` | `alerta` | `info`
- **bloqueia_procedimento**: se `true`, o procedimento fica bloqueado quando a regra bater.
- **regra**: objeto JSON no formato abaixo.

### Formato de `regra`

```json
{
  "conditions": [
    { "field": "ficha.gestante", "op": "eq", "value": "sim" },
    { "field": "ficha.dum", "op": "absent" }
  ],
  "message": "Gestação declarada. Contraindicação absoluta para toxina/preenchimento até avaliação médica."
}
```

### Operadores (`op`)

| op       | Descrição |
|---------|-----------|
| `eq`    | Igual (string case-insensitive) |
| `ne`    | Diferente |
| `in`    | Valor em lista (value é array) |
| `present` | Campo preenchido (não vazio) |
| `absent`  | Campo vazio ou ausente |
| `gt`, `gte`, `lt`, `lte` | Comparação numérica |

### Campos comuns na `ficha` (por slug)

- **injetáveis**: `gestante`, `alergias`, `historico_preenchimentos`, `doenca_transmissivel_sangue`, `tumor_lesao_cancerosa`, etc.
- **corporal**: além da ficha, use `anthropometry.imc`, `anthropometry.rcq`, `anthropometry.classificacao_imc.faixa`.
- **simples**: `problema_pele`, `alergias_cremes`, `gestante`.

### Exemplo de bloqueio automático (injetáveis)

Regra: contraindicação absoluta + bloquear procedimento se gestante = sim.

```json
{
  "nivel": "contraindicacao_absoluta",
  "bloqueia_procedimento": true,
  "regra": {
    "conditions": [{ "field": "ficha.gestante", "op": "eq", "value": "sim" }],
    "message": "Gestação declarada. Procedimento contraindicado até avaliação médica."
  }
}
```

Inserção no Supabase (via app ou SQL):

```sql
INSERT INTO anamnesis_regras (org_id, tipo_id, nome, nivel, bloqueia_procedimento, regra, ordem)
VALUES (
  '<org_id>',
  'injetaveis',
  'Gestante',
  'contraindicacao_absoluta',
  true,
  '{"conditions":[{"field":"ficha.gestante","op":"eq","value":"sim"}],"message":"Gestação declarada. Procedimento contraindicado até avaliação médica."}'::jsonb,
  0
);
```

---

## 3. Serviço de score (uso no app)

```js
import { runScoreEngine } from "../services/anamnesis-score.service.js";

const tipoId = "injetaveis"; // ou "corporal" | "simples"
const data = { ficha: { gestante: "sim", alergias: "nao" }, anthropometry: null };
const result = await runScoreEngine(tipoId, data);
// result.score (0–4), result.nivelPior, result.bloqueio, result.alertas
// Persistir em anamnesis_registros: score_result = result, bloqueio_procedimento = result.bloqueio
```

---

## 4. Antropometria (módulo corporal)

Serviço: `anamnesis-corporal.service.js`.

- **IMC**: `peso_kg / altura_m²`
- **RCQ**: `cintura_cm / quadril_cm` (limiar homem ≥0,90; mulher ≥0,85)
- **Waist/height**: `cintura_cm / altura_cm` (risco >0,5)
- **Classificação metabólica**: resumo texto (IMC + RCQ + waist/height)

Uso: ao salvar registro corporal, preencher `anthropometry` com `buildAnthropometry({ peso_kg, altura_m, cintura_cm, quadril_cm, sexo })`. Histórico versionado permite comparação evolutiva (mesmo cliente, vários registros ordenados por data).

---

## 5. Análise de pele (skincare) e anamnese

- **Feita pelo profissional (na clínica)**  
  Fluxo completo de anamnese (função Pele / tipo simples ou injetáveis conforme procedimento). Ficha completa, score, bloqueio. A análise de pele pode ser registrada com `origem = 'profissional'` e vinculada ao registro de anamnese.

- **Feita pelo cliente (portal)**  
  Formulário **objetivo** no portal: poucas perguntas essenciais (queixa, medicamentos, alergias, gestação, uso de ácidos, etc.) + fotos. Esses dados vão em `analise_pele.respostas` e, após validação, podem ser incorporados à anamnese (Pele).  
  Objetivo: dar **ação palpável** (não só pela imagem): contraindicações e alertas já aparecem no resumo para o profissional e aumentam a acertividade da conduta.

Coluna `analise_pele.origem` (`cliente` | `profissional`) diferencia o fluxo na tela e nos relatórios/PDF.

---

## 6. Histórico versionado e comparação evolutiva

- `anamnesis_registros.version`: número sequencial por cliente/função (ou por cliente global). Ao criar novo registro, incrementar.
- Comparação evolutiva corporal: listar registros do cliente com `tipo_anamnese = 'corporal'` ordenados por data; exibir tabela ou gráfico de IMC, RCQ, cintura ao longo do tempo.

---

## 7. Auditoria e assinatura

- **anamnesis_audit_log**: a cada criação/edição de registro, inserir linha com `action` (create, update, score_recalc) e `payload` (opcional).
- **anamnesis_assinaturas**: um registro por `registro_id` + `signer_type` (profissional, cliente, responsavel). PDF pode exibir “Assinado por: … em …”.

---

## 8. Catálogos dinâmicos

Tabela `anamnesis_catalogos`: por org e tipo, `slug` (ex.: `produto_toxina`), `nome`, `options` (array de `{ value, label }`). O admin edita; o formulário da anamnese carrega os selects a partir daí. Fallback: opções fixas no front (ex.: FICHA_CAMPOS com options estáticas).

## 8.1. Campos personalizados (conforme demanda da clínica)

Cada **área/função** (Capilar, Rosto Pele, Injetáveis, Corporal) pode ter campos extras, adicionados pela clínica para adaptar a ficha à sua rotina.

- **Tabela**: `anamnesis_campos_personalizados` (org_id, funcao_id, key, label, type, placeholder, options, ordem).
- **Na tela de Anamnese**: ao final da ficha aparece o bloco **"Incluir mais (conforme sua clínica)"**.
  - **+ Adicionar campo**: master/gestor abre modal para criar campo (nome, chave única, tipo: texto, textarea, Sim/Não, número, lista). Os valores entram no mesmo `ficha` do registro.
  - Cada campo personalizado listado pode ser **removido** (×) por master/gestor; os dados já salvos em registros antigos não são apagados.
- Assim a ficha fica com a **cara da clínica**: perguntas padrão + o que a clínica quiser incluir por área.

---

## 9. PDF por tipo

- Um layout/template por tipo (injetáveis, corporal, simples): cabeçalho, ficha, antropometria (se corporal), score e alertas, conduta, assinaturas.
- Dados vêm de `anamnesis_registros` (conteudo, ficha, anthropometry, score_result, conduta_tratamento) + `anamnesis_assinaturas`.

---

## 10. Estrutura de pastas (referência)

```
js/
  services/
    anamnesis.service.js          # CRUD registros, funções, upload fotos
    anamnesis-score.service.js   # Motor de regras e score
    anamnesis-corporal.service.js # IMC, RCQ, waist/height, classificação
    analise-pele.service.js      # Análise de pele + incorporar na anamnese
  views/
    anamnese.views.js            # UI por função/tipo (ficha dinâmica, score, bloqueio)
docs/
  ANAMNESE-MODULAR.md            # Este arquivo
supabase-anamnese-modular.sql    # Tipos, regras, colunas, catálogos, audit, assinaturas
```

Implementação atual: **Supabase + JS** (sem React/Prisma). Para um futuro módulo em React + Node + Prisma, a mesma modelagem pode ser espelhada (entidade base Anamnesis + subtipos InjectableAnamnesis, BodyAnamnesis, SimpleProcedureAnamnesis) com os mesmos conceitos de score, regras em JSON e antropometria.
