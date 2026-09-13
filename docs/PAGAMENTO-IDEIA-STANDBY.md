# Pagamento pelo app — ideia em standby

Documento interno: visão de produto para adesão de pagamento dentro da plataforma. **Não está visível na UI**; fica no repositório para não perder a ideia e para futura implementação.

---

## Visão

- Transformar a plataforma em algo que **realmente ajorde as empresas** (clínicas).
- **Aderir pagamento pelo app**: as clínicas passam a aceitar cartão (e/ou PIX) integrado ao sistema.
- **Negociação com operadora/adquirente**: usar o **volume agregado** de todas as clínicas da plataforma para negociar com uma empresa de cartão (adquirente) e conseguir **taxas melhores** para as clínicas.
  - Quanto mais faturamento (volume), mais desconto nas taxas — isso é usado **a favor do app** na negociação.
- **Ganho para a empresa (clínica)**: a clínica deve **ganhar algo com isso**, mas esse ganho vem da **operadora** (participação, bônus, revenue share), **não dos clientes finais** (pacientes não pagam a mais por isso).

---

## Modelo em poucas linhas

1. **Plataforma** negocia com **uma (ou mais) operadora de pagamento** em nome de todas as clínicas.
2. **Volume agregado** → taxas menores para as clínicas do que elas teriam sozinhas.
3. **Operadora** cede parte da margem para a **plataforma** e/ou para a **clínica** (rev share, bônus por volume, etc.).
4. **Cliente final** (paciente) paga o mesmo ou menos; o desconto e o ganho vêm da operadora, não do preço cobrado do paciente.

---

## Por que faz sentido

- **Para a clínica:** paga menos taxa e ainda pode receber uma parte (da operadora), sem repassar custo ao paciente.
- **Para a operadora:** ganha volume concentrado e previsível; pode abrir mão de um pouco de margem em troca de escala.
- **Para a plataforma:** diferenciação ( “pagamento com taxa melhor dentro do app” ) e possível receita (rev share da operadora ou fee transparente combinado com a clínica).

É um modelo conhecido (agregação + rev share com adquirente); o diferencial é aplicar isso no nicho de clínicas e deixar claro que o benefício e o ganho vêm da operadora, não do cliente.

---

## Status

- **Implementado em standby:** a funcionalidade existe no código mas fica **escondida** até você ativar.
- **Como está hoje:** o card “Pagamento pelo app” **não aparece** em Configurações; a rota e a tela existem mas só quem acessar diretamente `#pagamento` vê a mensagem “Em standby”.

---

## Como ativar quando fechar a negociação

1. Abra **`js/core/feature-flags.js`**.
2. Altere **`PAGAMENTO_APP_ENABLED`** de `false` para **`true`**.
3. Salve e recarregue o app.

**Efeito:** o card **“Pagamento pelo app”** passa a aparecer em **Configurações** e, ao clicar em Abrir, a tela mostra o estado “ativo” (placeholder para “Solicitar adesão”). A partir daí é só ligar o botão à API da operadora quando tiver o contrato.

---

## Onde está no app (implementado)

- **Configurações** (Master): card “Pagamento pelo app” — **visível só quando** `PAGAMENTO_APP_ENABLED === true`.
- **Rota** `#pagamento`: view “Pagamento pelo app” (conteúdo standby ou ativo conforme o flag).
- **Ficheiros:** `js/core/feature-flags.js`, `js/views/pagamento.views.js`, seção `#view-pagamento` no `dashboard.html`, estilos em `style.css`.
