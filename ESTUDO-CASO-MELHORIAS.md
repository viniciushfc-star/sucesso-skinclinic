# Estudo de caso — melhorias sugeridas

Três melhorias que aumentam o valor da ideia sem virar BI confuso (mantendo no máximo 2–3 métricas).

---

## 1. Frase de tendência por perfil (tipo de pele + queixa)

**O que é:** Hoje a agregação é só **por protocolo** (“Para perfis semelhantes (n=20), este protocolo teve melhora em 75%”). Melhoria: **agrupar também por perfil** (tipo_pele + queixa_principal) e mostrar uma segunda frase quando houver dados: *“Entre casos com perfil **oleosa + melasma** (n=5): melhora em 80%.”*

**Por quê:** O profissional na hora da decisão pensa “para um paciente **como este** (tipo X, queixa Y), o que a experiência da clínica mostra?”. Um número só do protocolo inteiro é útil; um número **do mesmo perfil** é mais alinhado à decisão clínica e continua anonimizado.

**Impacto:** Decisão mais baseada em evidência interna (histórico da própria clínica), sem aumentar métricas demais — são as mesmas 2–3 (resposta, perfil, opcional volume), só exibidas de duas formas: global no protocolo e filtrada por perfil quando existir amostra.

**Implementação resumida:** Na agregação, além do total por protocolo, agrupar casos por `(tipo_pele, queixa_principal)` (ou chave normalizada); na UI, mostrar a frase global e, se houver, 1–2 frases por perfil com n ≥ 2 (evitar n=1).

---

## 2. Vínculo opcional ao “protocolo aplicado” (sem quebrar anonimato)

**O que é:** Na tabela `estudo_casos`, acrescentar coluna opcional **protocolo_aplicado_id** (FK para `protocolos_aplicados`). Ao registrar “para estudo de caso” a partir do perfil do cliente (logo após registrar o que foi aplicado), gravar esse id. **Não** guardar client_id; o caso continua anonimizado na tela e nas agregações.

**Por quê:** (a) Saber que aquele caso veio de uma **aplicação real** (agenda + cliente) dá mais confiança ao dado. (b) Permite no futuro métricas do tipo “casos baseados em aplicação real” vs “entrada manual”. (c) Se a clínica precisar de auditoria interna (“qual atendimento gerou este caso?”), só quem tem acesso ao banco vê o id da aplicação — a interface continua sem expor o cliente.

**Impacto:** Rastreabilidade e qualidade do dado (casos “reais” vs teóricos) sem perder anonimato na UI; base para métricas de confiança do histórico (ex.: “80% dos casos com melhora vêm de aplicações registradas na agenda”).

**Implementação resumida:** Migration em `estudo_casos`: `protocolo_aplicado_id uuid REFERENCES protocolos_aplicados(id) ON DELETE SET NULL`. No perfil, ao clicar “Registrar para estudo de caso”, enviar o último `protocolo_aplicado_id` daquele cliente/protocolo (ou o que acabou de ser criado) no payload; serviço grava quando existir.

---

## 3. “Minha aprendizagem” — histórico de perguntas e esclarecimentos do usuário

**O que é:** Uma vista (aba ou seção) **“Minha aprendizagem”**: listar as **perguntas e esclarecimentos** feitos pelo **usuário logado** (filtro por `created_by`), ordenadas por data, com link para o caso/protocolo. Sem mudar onde as perguntas são feitas (continuam no caso); só reunir em um lugar para revisão.

**Por quê:** Hoje as perguntas ficam “dentro” de cada caso. O profissional que fez várias perguntas e esclareceu dúvidas pode querer **revisar o que aprendeu** (ex.: antes de um atendimento ou em formação). Ter um único lugar “o que eu perguntei e o que a IA respondeu” favorece retenção e uso do estudo de caso no dia a dia.

**Impacto:** Maior uso e retenção do aprendizado; reforça o ciclo “perguntar → ler artigo → esclarecer → revisar”. Continua sem criar nova métrica; é apenas outra forma de navegar o que já está salvo.

**Implementação resumida:** RPC ou query em `estudo_caso_perguntas` com join em `estudo_casos` e `protocolos`: filtrar por `created_by = auth.uid()`, ordenar por `created_at` desc. Na tela Estudo de caso, aba ou link “Minha aprendizagem” que lista essas linhas (pergunta, trecho da resposta, nome do protocolo, data).

---

## Priorização sugerida

| Ordem | Melhoria              | Esforço | Impacto clínico / uso |
|-------|------------------------|---------|------------------------|
| 1     | Frase por perfil       | Médio   | Alto — decisão mais alinhada ao perfil do paciente. |
| 2     | Minha aprendizagem    | Baixo   | Alto — revisão e retenção do que foi aprendido.      |
| 3     | protocolo_aplicado_id | Baixo   | Médio — qualidade e rastreabilidade do dado.        |

Implementar na ordem 1 → 2 → 3 equilibra valor e esforço sem fugir da regra de 2–3 métricas.
