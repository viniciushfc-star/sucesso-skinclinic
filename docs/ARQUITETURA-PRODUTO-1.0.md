# Arquitetura de produto SkinClinic 1.0

**Data:** 2026-09-20  
**Tese:** Clínica → dados → contexto → inteligência → ação. A decisão permanece humana.

---

## 1. Cadeia operacional (contrato)

```
CLIENTE → AVALIAÇÃO → ANAMNESE → PLANO → PROCEDIMENTO
       → PROTOCOLO → PROTOCOLO APLICADO → ESTOQUE → CUSTO
       → MARGEM → EVOLUÇÃO → RETORNO → RELACIONAMENTO → RECOMPRA
```

Acima: IA + insights + metas. Abaixo: isolamento por organização.

## 2. Distinções travadas

| Conceito | É | Não é |
|----------|---|--------|
| Plano | Resposta à dor + conjunto de procedimentos + valores | Protocolo |
| Protocolo | Método de execução + insumos previstos | Oferta comercial |
| Protocolo aplicado | O que ocorreu na sessão | Rascunho de IA |
| Financeiro | Consolidação e explicação | Precificador |
| Precificação | Simulação e sugestão | Alteração automática |
| Copilot | Explica dados internos | Market Radar / diagnóstico |
| Estoque | Apoio a custo e falta | ERP que bloqueia atendimento |

## 3. Camadas técnicas (estado alvo)

```
[PWA SPA]  --anon JWT-->  [Postgres + RLS]
[PWA SPA]  --Bearer+org--> [Express /api] --service role--> [Postgres]
[Portal]   --token hash--> [RPC SECURITY DEFINER]
[Cron/WA]  --secret-->     [Express]
```

Frontend **nunca** é controle de acesso.  
Service role **nunca** no browser.

## 4. Identidade e tenant

- `organizations`  
- `organization_users` (role)  
- `organization_user_permissions` (override)  
- Ingresso **somente** por convite válido + aceite  

Papéis alvo (não implementados como enum único hoje): MASTER, GESTOR, PROFISSIONAL, RECEPÇÃO, VIEWER.

## 5. Eventos (alvo P2 — Intelligence)

Eventos internos (agendamento, falta, pagamento, consumo, margem) alimentam um agregador, não um chat a cada clique. Copiloto lê o agregado. Notificação só para Atenção.

## 6. O que já existe vs o que a tese exige

O repositório já tem **módulos**. Falta o **grafo**: procedimento não consome de forma visível o custo real do lote; dashboard não é o OS; IA não observa a operação em tempo quase real.

## 7. Princípio de evolução

Não criar segundo financeiro, segundo estoque, segundo copiloto. Cada P1 estende a tabela e o serviço existentes.
