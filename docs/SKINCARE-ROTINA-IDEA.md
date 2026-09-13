# Rotina de Skincare como Acompanhamento — Ideia e Monetização

Documento para amadurecer a ideia e orientar a implementação futura.

---

## 1. O QUE É

**Rotina de skincare como acompanhamento** = plano de cuidados (produtos, ordem, frequência) que o profissional define **após** validar a análise de pele e/ou anamnese (função Pele), entregue ao cliente no portal para ele seguir em casa e acompanhar.

- Não é análise de pele (essa é pré-anamnese, validada pela clínica).
- Não é prescrição automática: o profissional monta ou valida a rotina.
- É **continuidade**: cliente vê “minha rotina”, segue, e a clínica pode acompanhar adesão e resultados.

---

## 2. OBJETIVO ESTRATÉGICO

- **Para o cliente:** ter rotina clara, acessível no portal, e sensação de acompanhamento (não fica solto após a consulta).
- **Para a clínica:** aumentar retenção, fidelização e **receita extra** (monetização).
- **Diferencial:** rotina vinculada ao que já foi validado (análise/anamnese), não genérica.

---

## 3. MONETIZAÇÃO

A clínica pode **liberar** a rotina de skincare por um valor a mais ou como parte de um pacote:

| Modelo | Descrição |
|--------|-----------|
| **Liberação por valor** | Cliente paga X (único ou recorrente) para “desbloquear” o módulo de rotina no portal. |
| **Pacote pós-consulta** | Incluído em “pacote pós-análise” ou “acompanhamento 30 dias”. |
| **Assinatura** | Acesso à rotina + atualizações/check-ins por período (ex.: mensal). |
| **Por sessão de acompanhamento** | Cada “revisão de rotina” ou “check-in” é cobrado; o portal exibe a rotina atual e histórico. |

**Implementação sugerida (fase 1):**

- Tabela ou flag por cliente/org: `skincare_rotina_liberado` (boolean ou data de liberação; ou plano “skincare_rotina”).
- No portal: botão/card **“Minha rotina de skincare”** só aparece se a clínica tiver liberado para aquele cliente.
- Cobrança: inicialmente manual (clínica marca “liberado” após pagamento/pacote); depois integrar com financeiro do sistema se houver.

---

## 4. ANÁLISE PARA VER RESULTADOS

A clínica precisa **enxergar** se a rotina está sendo usada e se há evolução:

| Métrica / Dado | Uso |
|----------------|-----|
| **Cliente acessou a rotina?** | Quantas vezes viu a tela “Minha rotina” no portal. |
| **Check-ins do cliente** | Perguntas simples periódicas: “Seguiu a rotina esta semana?” (sim/não/parcial), “Alguma reação?”. |
| **Nova análise de pele** | Cliente pode refazer análise de pele depois de X tempo; clínica compara com a anterior (mesmo fluxo: IA analisa → clínica valida → devolutiva). |
| **Dashboard clínica** | Lista de clientes com rotina liberada; taxa de acesso; última análise comparativa (se houver). |

**Implementação sugerida:**

- Eventos no portal: “visualizou_rotina”, “respondeu_checkin”.
- Tabela `skincare_rotinas` (org_id, client_id, texto/JSON da rotina, liberado_em, criado_por).
- Tabela `skincare_checkins` (client_id, data, respostas JSON) ou uso de `client_events` com tipo “skincare_checkin”.
- Relatório ou view: “Clientes com rotina ativa” e “Última análise de pele” por cliente para comparar antes/depois.

---

## 5. FLUXO PROPOSTO (PASSO A PASSO)

1. **Clínica** valida análise de pele e/ou preenche anamnese (função Pele).
2. **Clínica** monta ou edita a rotina de skincare do cliente (produtos, ordem, orientações).
3. **Clínica** “libera” a rotina para o cliente (e, se aplicável, registra cobrança ou pacote).
4. **Cliente** no portal vê o card **“Minha rotina de skincare”** (se liberado) e acessa a rotina.
5. **Opcional:** cliente responde check-ins periódicos; clínica vê no dashboard.
6. **Opcional:** cliente refaz análise de pele após um tempo; clínica compara e ajusta rotina.

---

## 6. O QUE JÁ EXISTE NO PROJETO

- **Análise de pele:** portal envia fotos + respostas → IA gera preliminar → clínica valida → cliente vê devolutiva só após validação.
- **Skincare (dashboard clínica):** item de menu “Skincare” com “Gerar rotina” (IA). Pode ser o ponto de partida para gerar o texto da rotina que o profissional valida e depois “libera” para o cliente.
- **Portal do cliente:** dashboard com “Análise de pele”, “Ver evolução”, etc. Aqui entraria o card **“Minha rotina de skincare”** (condicional a liberação).

---

## 7. PRÓXIMOS PASSOS (IMPLEMENTAÇÃO)

1. **Modelo de dados:** `skincare_rotinas` (por cliente/org), `skincare_rotina_liberada` (flag ou data por cliente) ou campo em `clients`/perfil.
2. **Dashboard clínica:** tela ou modal para montar/editar rotina por cliente e botão “Liberar rotina no portal” (e opcionalmente registrar valor/pacote).
3. **Portal:** card “Minha rotina de skincare” (visível só se liberado); tela com a rotina (texto/etapas) e opcionalmente check-in simples.
4. **Métricas:** registro de acesso à rotina e de check-ins; relatório “Clientes com rotina” e “Última análise” para a clínica.
5. **Monetização:** integração com financeiro (item “Liberação rotina skincare” ou pacote) quando o fluxo de cobrança estiver definido.

---

## 8. FRASES-GUIA

- “Rotina só existe após validação profissional.”
- “A clínica libera; o cliente acompanha.”
- “Monetização é a clínica cobrar pelo valor do acompanhamento, não pela IA sozinha.”
- “Análise para ver resultados = acesso à rotina + check-ins + nova análise de pele quando fizer sentido.”

Este documento pode ser usado para alinhar produto, desenvolvimento e operação da clínica antes de codar.
