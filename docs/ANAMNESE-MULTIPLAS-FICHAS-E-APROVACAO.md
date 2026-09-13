# Anamnese: múltiplas fichas por paciente e fluxo de edição com aprovação

## O que o usuário pediu

- **Mais de uma ficha de anamnese por paciente** — documento sensível; o ideal não é ficar editando o mesmo registro.
- **Edição por espelho:** ao editar, gerar um “arquivo espelho” para edição; quando o master ou o gestor aprovar, aplicar a alteração no registro original.

## Situação atual

- Já existem **vários registros por cliente** (por função/área): cada “Salvar ficha” gera um novo registro em `anamnesis_registros`. Ou seja, já há múltiplas “fichas” (registros evolutivos) por paciente.
- Não existe hoje:
  - **Edição** de um registro já salvo (só criar novo).
  - **Cópia espelho** para editar e depois aplicar no original.
  - **Aprovação** por master/gestor para “confirmar” a edição.

## Proposta de implementação futura

1. **Tabela `anamnesis_registros`**
   - Colunas opcionais:
     - `status`: `'ativo'` (padrão) | `'rascunho_edicao'` (espelho em edição).
     - `parent_id`: UUID do registro “original” quando este registro for o espelho de edição.
   - Regra: só pode haver um espelho por original (um `parent_id` por registro ativo).

2. **Fluxo**
   - Na tela de histórico, botão **“Editar”** em um registro:
     - Cria um novo registro com `parent_id = id do registro clicado`, `status = 'rascunho_edicao'`, copiando ficha, fotos, conduta, etc.
     - Abre o formulário preenchido com esse espelho (o usuário altera o que quiser).
   - Botão **“Salvar edição”**: atualiza apenas o espelho (não altera o original).
   - Botão **“Enviar para aprovação”** (visível para quem editou): o espelho fica “pendente_aprovacao” ou segue em “rascunho_edicao” até um master/gestor aprovar.
   - Para **master/gestor**: botão **“Aprovar alteração”** no espelho:
     - Copia conteúdo do espelho (ficha, fotos, conduta, etc.) para o registro original (`parent_id`).
     - Opção: marcar o original como “substituído pela edição de [data]” (auditoria) ou apenas sobrescrever.
     - Remove ou arquiva o espelho (status = 'aprovado' ou deletar).

3. **Permissões**
   - Editar (criar espelho): quem tem permissão de anamnese (ex.: staff, gestor, master).
   - Aprovar: apenas master ou gestor (conforme regras do app).

4. **UI**
   - No histórico, registro “original” pode mostrar um aviso: “Edição pendente de aprovação” quando existir espelho com status pendente.
   - Listar “Minhas edições pendentes” (espelhos que criei e ainda não aprovados) e “Edições para aprovar” (para master/gestor).

## Resumo

- **Múltiplas fichas:** já existem (vários registros por cliente/área).
- **Edição sem mexer no original + aprovação:** exige novo fluxo (espelho + status + aprovação por master/gestor); pode ser implementado conforme este documento em uma próxima etapa.
