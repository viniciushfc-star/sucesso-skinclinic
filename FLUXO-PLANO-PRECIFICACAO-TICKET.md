# Como o programa ajuda: plano atraente, lucro mantido e ticket médio maior

Este documento mostra o **fluxo** em que a clínica cria um plano para o cliente e como as ferramentas do sistema (**Procedimentos**, **Precificação e taxas**, **Financeiro**) ajudam a deixar o plano **atraente financeiramente** para o cliente, **mantendo o lucro** da empresa e **elevando o ticket médio**.

---

## 1. O fluxo em 4 passos

```
1. Clínica cadastra procedimentos e preços
        ↓
2. Clínica configura as taxas reais do banco (Precificação e taxas)
        ↓
3. Clínica monta o plano (pacote) e usa o simulador para definir valor e condições
        ↓
4. Cliente compra o plano (à vista com desconto ou parcelado) → lucro previsível e ticket maior
```

---

## 2. Exemplo numérico completo

### Cenário

- **Procedimento:** Limpeza de pele (R$ 350 por sessão).
- **Plano:** “Pacote 6 sessões” = 6 × R$ 350 = **R$ 2.100** (valor do plano).
- **Taxas da maquininha** (configuradas em **Precificação e taxas**):
  - À vista: 1,99%
  - 2x a 6x: 3,49%
  - 7x a 12x: 4,99%

### O que o simulador mostra (tela Precificação e taxas)

Ao digitar **R$ 2.100** no campo “Valor do procedimento” (ou do plano), o sistema mostra algo como:

| Forma   | Taxa  | Você recebe | Diferença vs à vista |
|---------|--------|-------------|------------------------|
| À vista | 1,99% | R$ 2.058,21 | — |
| 2x      | 3,49% | R$ 2.026,71 | − R$ 31,50 |
| 3x      | 3,49% | R$ 2.026,71 | − R$ 31,50 |
| …       | …     | …           | … |
| 6x      | 3,49% | R$ 2.026,71 | − R$ 31,50 |
| 7x a 12x| 4,99% | R$ 1.995,21 | − R$ 63,00 |

- **Desconto à vista:**  
  “Se o cliente pagar à vista, você pode dar até **X%** de desconto e ainda receber o mesmo ou mais que em 12 parcelas.”
- **Recomendação:**  
  “Para manter mais lucro: prefira até **6 parcelas** (taxa 3,49%) ou ofereça até **X%** de desconto à vista.”

### Como a clínica usa isso na prática

1. **Mantém o lucro**  
   Ela sabe exatamente quanto entra no caixa em cada opção (à vista, 6x, 12x). Não “chuta” desconto nem parcelas.

2. **Deixa o plano atraente**  
   - Oferece **até 6x sem juros** (taxa menor que 12x) → cliente paga em 6x de R$ 350.  
   - Ou oferece **desconto à vista** dentro do limite que o simulador mostrou → cliente paga à vista e a clínica ainda recebe pelo menos o que receberia em 12x.

3. **Eleva o ticket médio**  
   Em vez de vender 1 sessão (R$ 350), vende o **plano 6 sessões** (R$ 2.100). O ticket sobe e o valor líquido é calculado com as taxas reais.

---

## 3. Exemplo: manter lucro e subir o ticket

### Antes (só sessão avulsa)

- Cliente paga **1 sessão** = R$ 350.  
- Clínica recebe (à vista, 1,99%): **R$ 343,04**.  
- **Ticket médio** = R$ 350.

### Depois (plano atrativo)

- Clínica monta o plano **“6 sessões – Limpeza”** = R$ 2.100.  
- Oferece: **6x de R$ 350** ou **à vista com 5% de desconto** (R$ 1.995).  
- O simulador já mostrou que até ~X% de desconto à vista ainda é melhor ou igual a 12x; 5% está dentro da margem.  
- Clínica recebe (ex.: à vista com 5% de desconto, 1,99%): sobre R$ 1.995 → valor líquido maior que em 12x de R$ 2.100.  
- **Ticket médio** = R$ 2.100 (em vez de R$ 350).  
- **Lucro:** valor líquido previsível; margem respeitada porque as taxas e o desconto foram decididos com base no simulador.

Resumo: o programa ajuda a **precificar o plano** (valor e condições) de forma que:
- o plano fique **atraente** (parcelas ou desconto à vista),
- o **lucro** seja mantido (você sabe o líquido por forma de pagamento),
- o **ticket médio** suba (venda do pacote em vez de só sessão avulsa).

---

## 4. Onde fazer cada coisa no app

| O quê | Onde |
|-------|------|
| Cadastrar procedimentos e valor cobrado | **Procedimentos** (valor usado em métricas e finanças) |
| Configurar taxas à vista, 2–6x e 7–12x | **Precificação e taxas** → “Suas taxas com o banco” |
| Simular “quanto você recebe” e desconto máximo à vista | **Precificação e taxas** → “Simulador: quanto você recebe” (digite o valor do **plano** ou do procedimento) |
| Montar o plano (nome, dor do cliente, procedimentos) | **Planos** / estrutura de planos terapêuticos (conforme seu fluxo de criação de planos) |
| Registrar recebimento e acompanhar impacto | **Financeiro** |

---

## 5. Frase-guia

**“O plano fica atraente para o cliente (parcelas ou desconto) e ainda assim lucrativo para a clínica, porque você define valor e condições com base no que realmente sobra depois das taxas — e o ticket sobe quando você vende o pacote em vez da sessão avulsa.”**

O módulo **Precificação e taxas** é o que conecta: **taxas reais do banco** → **valor líquido por forma de pagamento** → **desconto máximo à vista** e **recomendações (ex.: até 6x)**. Usando esse fluxo, a clínica consegue criar planos financeiramente atraentes, mantendo o lucro e elevando o ticket médio.
