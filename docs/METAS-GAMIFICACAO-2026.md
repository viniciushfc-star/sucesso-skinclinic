# Metas e Evolução da Clínica — 2026

## Metas hoje

Tabela `financeiro_metas` + `financeiro-metas.service.js`, UI restrita a **master**. Sem ritmo, sem previsão, sem metas de ocupação/retorno.

## P2-2 (implementado)

Receita e lucro mensais: realizado no financeiro do `periodo_ref` (YYYY-MM). Ritmo atual vs necessário, projeção linear. **Projeção, não garantia.** Sem XP (P3). Reserva de emergência usa saldo de caixa, sem R$/dia.

## Metas alvo (P2)

Dimensões: financeiro, comercial, operacional, retenção, marketing, estoque.  
Campos: período, objetivo, realizado, %, restante, ritmo necessário, ritmo atual, previsão.  
Copy: “projeção, não garantia.”

Dependência: `financeiro` + `agenda` canônicos (P0).

## Gamificação = Evolução da Clínica (P3 bloqueado)

Não infantilizar. Modelo: META → AÇÃO → RESULTADO → XP → NÍVEL.

Incentivar: organização, retenção, margem, menos desperdício, protocolos preenchidos, metas.  
Não incentivar: volume clínico inseguro, spam, maquiagem de KPI.

**Não implementar** com P0/P1 abertos. Não há tabela de XP no repo.
