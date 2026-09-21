# Mapa de fluxos SkinClinic — 2026

Cada fluxo: o que o código **tenta** fazer. Onde o grafo **quebra**. Live = NÃO COMPROVADO.

## A. Staff — operação do dia

```
LOGIN (index) → bootstrap
  → org? dashboard.html
  → convite? #accept-invite
  → senão onboarding.html (nome)
```

**Quebra:** sem setup progress (profissional, procedimento, estoque, meta).

## B. Cadeia clínica (coração)

| Elo | Implementação | Grafo |
|----|-----------------|-------|
| Cliente | `clients` | OK no código |
| Avaliação | anamnese + estudo caso | PARCIAL nome |
| Anamnese | registros + portal RPC | OK desenho |
| Plano | `planos_terapeuticos` | **fraco** na ficha/agenda |
| Procedimento | `procedures` no horário | OK |
| Protocolo método | `protocolos` + tela IA | **dois caminhos** |
| Aplicado | `protocolos_aplicados` + atalho agenda (`sessionStorage`) | PARCIAL disciplina |
| Estoque | trigger consumo | **se SQL live** NÃO COMPROVADO |
| Custo real | estimado no cadastro | **quebra** |
| Margem | card produto ≥15% | **quebra** no procedimento |
| Evolução | fotos | OK código |
| Retorno | is_retorno + CRM 90d | **quebra** ritmo |
| Relacionamento | WA manual | PARCIAL |
| Recompra | pacotes | PARCIAL |

## C. Agenda → aplicado → consumo (ideal)

```
agenda.views → painel → sessionStorage clientePerfilOpenTab=protocolo
→ cliente-perfil aba protocolo → protocolos_aplicados
→ trigger estoque_consumo
```

**Quebra:** financeiro da sessão não é automático só por aplicar; baixa financeira é outro botão (histórico de “baixa já registrada”).

## D. Portal cliente

```
staff create-portal-session (hash)
→ portal.html?token=
→ RPC get_client_session_by_token (hash, fallback plaintext)
→ cadastro / termo / anamnese / analise-pele API / skincare se liberado / agenda portal
```

**Quebra:** não é “Minha jornada”. Preliminar: rotas portal-list + testes p0-02 no **código**; live NÃO COMPROVADO.

## E. Pele (obrigatório)

```
fotos+respostas → POST /api/analise-pele (token) → ia_preliminar interno
→ staff valida → texto_validado
→ cliente lista sanitizada
```

Canônico alinhado no código da API de lista.

## F. Skincare

IA → tabela rascunho → flags de liberação → RPC token. **Não** provar que não há caminho vazado no live.

## G. Dinheiro

Agenda realizada ↛ financeiro automático (exceto fluxos explícitos). Contas a pagar → saída. Webhook → `financeiro` se conta vinculada. Precificação = cadastro + `/api/preco` rascunho.

## H. Importação

CSV `#export` → insert direto. Sem batch rollback.

## I. E2E pedido (Fase 5) — status

LOGIN→ORG→CLIENTE→AGENDA→…→PORTAL: **NÃO COMPROVADO** como suíte.  
Há testes de contrato, não Playwright/tenant.

## J. Matriz tenant (Fase 2) — este ciclo

| Superfície | Org A própria | Org A → Org B |
|------------|---------------|----------------|
| SELECT/INSERT/UPDATE/DELETE tabelas | NÃO COMPROVADO live | **NÃO COMPROVADO** |
| RPC portal | código filtra client_id da sessão | **NÃO COMPROVADO** live |
| Storage | SQL 20260920 | **NÃO COMPROVADO** live |
| APIs staff | membership org_id | **NÃO COMPROVADO** live (unitário só helpers) |
| Export/backup | código filtra org ativa | restore perigoso; cruzado **NÃO COMPROVADO** |
| IA | org no body após membership | prompt leak **NÃO COMPROVADO** |
| Cron lembretes | todas as orgs no servidor | esperado; precisa secret |

Não aceitar “parece protegido”. Próximo ciclo de prova: queries A/B no projeto Supabase.
