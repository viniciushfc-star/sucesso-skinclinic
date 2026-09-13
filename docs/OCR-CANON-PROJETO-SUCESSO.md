# OCR — O que foi pensado no Projeto Sucesso

**Transcrição canônica.** Este documento fixa o papel e os limites do OCR no produto.

---

## 1. Papel central do OCR (ideia base)

O OCR **não** foi pensado como tecnologia protagonista.  
Foi pensado como:

**porta de entrada automática de dados** que normalmente seriam esquecidos, digitados errado ou não lançados.

**Função principal:**

- reduzir digitação  
- reduzir erro  
- reduzir dependência da memória humana  
- aumentar fidelidade dos dados  

📌 **OCR é meio, não fim.**

---

## 2. Onde o OCR entra no sistema

O OCR foi idealizado para atuar principalmente em **três frentes**:

1. **Estoque**  
2. **Financeiro**  
3. **Custos operacionais** (derivados)

**Nunca** como módulo isolado.

---

## 3. OCR no estoque (uso mais claro)

Essa foi a ideia mais forte.

O OCR serve para:

- entrada de produtos  
- leitura de notas fiscais  
- leitura de DANFE  
- leitura de comprovantes de compra  

Pode extrair:

- nome do produto  
- quantidade  
- valor  
- fornecedor  
- data  
- lote (quando disponível)  

📌 **OCR sugere dados, não fecha verdade.**

---

## 4. OCR como facilitador, não verdade absoluta

Princípio que apareceu várias vezes:

**OCR não decide.**  
**OCR sugere.**  
**Humano confirma.**

O sistema:

- permite ajuste  
- aceita erro  
- registra histórico  

📌 **Divergência não é falha, é informação.**

---

## 5. OCR ↔ Financeiro

No financeiro, o OCR foi pensado para:

- capturar gastos esquecidos  
- evitar sublançamento  
- cruzar com extrato bancário  
- alimentar custo real  

Exemplo:  
*nota escaneada → gasto entra* | *banco mostra débito → sistema cruza*

📌 **OCR ajuda a não deixar nada para trás.**

---

## 6. OCR ↔ Precificação

Essa conexão foi muito importante no raciocínio do produto.

**Fluxo idealizado:**

1. OCR lê nota  
2. Produto entra com novo custo  
3. Estoque atualiza custo médio  
4. Financeiro cruza impacto  
5. Precificação é alertada  
6. Copilot explica possível impacto  

📌 **Nada automático. Tudo explicável.**

---

## 7. OCR como base de histórico (não contabilidade)

O OCR:

- **não** substitui contador  
- **não** fecha imposto  
- **não** valida fiscalmente  

Serve para:

- histórico interno  
- análise de custo  
- tomada de decisão  

📌 **Contabilidade formal continua externa, se necessário.**

---

## 8. Experiência do usuário (UX do OCR)

A ideia de UX sempre foi:

- OCR **na mesma tela** do fluxo  
- sem upload escondido  
- sem “modo técnico”  

Exemplo:

- Dentro do **Estoque** → “Adicionar via OCR”  
- Dentro do **Financeiro** → “Importar documento”  

📌 **OCR aparece onde faz sentido, não como menu separado.**

---

## 9. O que o OCR não faz (ideia original)

OCR **não** foi pensado para:

- exigir nota perfeita  
- bloquear operação por erro  
- virar obrigação  
- ser único meio de entrada  

**Entrada manual sempre existe.**

---

## 10. OCR ↔ Copilot

O Copilot **pode**:

- explicar dados lidos pelo OCR  
- apontar inconsistência  
- cruzar com histórico  

O Copilot **não pode**:

- corrigir automaticamente  
- assumir erro humano  
- tomar decisão sozinho  

---

## 11. Frases-guia do OCR

- *“Quanto menos digitar, melhor.”*  
- *“O sistema não pode depender da memória da clínica.”*  
- *“OCR ajuda a lembrar, não a decidir.”*  
- *“Se o dado entrou, o sistema faz sentido dele.”*

---

## 12. Status final

**OCR — conceito fechado e coerente.**

Ele:

- fortalece estoque  
- fortalece financeiro  
- fortalece precificação  
- reduz erro humano  
- não vira gargalo  

Nada aqui conflita com: ética, operação, clínica, posicionamento SaaS.
