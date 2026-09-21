# Matriz multi-tenant SkinClinic — 2026

**Regra deste ciclo:** sem teste executado contra o banco live = **NÃO COMPROVADO**.  
Código sugere isolamento por `org_id` + membership; **não** é prova.

| Módulo | Org A própria (esperado no SQL) | Org A → dado B | INSERT | UPDATE | DELETE | RPC | Storage | Export |
|--------|----------------------------------|----------------|--------|--------|--------|-----|---------|--------|
| clients | policy org members | NÃO COMPROVADO | NÃO COMPROVADO | NÃO COMPROVADO | NÃO COMPROVADO | — | client-photos SQL 20260920 | backup.service org |
| agenda | rls-agenda.sql | NÃO COMPROVADO | idem | idem | idem | portal/public agenda | — | CSV org |
| appointments | **sem CREATE no grep** | risco se tabela live sem RLS | — | — | — | — | — | — |
| financeiro | migration P0 policy | NÃO COMPROVADO | webhook service role pela conta | | | | | |
| estoque_* | canon RLS | NÃO COMPROVADO | | | | | | |
| protocolos_aplicados | canon RLS | NÃO COMPROVADO | | | | | | |
| analise_pele | policy + RPC token | portal-list filtra client | submit RPC | | | get/submit | bucket pele | |
| client_sessions | token hash mig | token de A em B | create staff | | | get_client_session_by_token | | |
| audit_logs | scripts | NÃO COMPROVADO | **FE pode inserir** | risco | risco | | | |
| whatsapp_logs | mig 20260920 se tabela existe | NÃO COMPROVADO | | | | | | |
| Storage anamnese-fotos | mig 20260920 | NÃO COMPROVADO | | | | | **NÃO COMPROVADO** | |
| AI routes | membership | org B no body → 403 se membership falhar | N/A | | | | | |

**Critério futuro de “foi testado e negado”:** evidência (query SQL ou teste automatizado) anexada. Até lá, **não** declarar isolamento aprovado.
