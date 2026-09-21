# Plano de testes — 2026

`npm test` (p0-01, p0-02, p0-03, imports, qa-catalog) **não** prova piloto.

## Camadas

UNIT (auth, hash portal, permissions map) · INTEGRATION API · RLS SQL · SECURITY IDOR · E2E · UX/mobile · PERFORMANCE · AI (não vazar preliminar) · PORTAL · MULTI-TENANT · MIGRATION CSV · FINANCEIRO · ESTOQUE · PREÇO · WHATSAPP · OCR.

## Cenários concretos

1. Org A JWT não lê `clients`/`agenda`/`financeiro`/`estoque_entradas` de B.  
2. Storage path `orgB/…` com usuário A → 403.  
3. RPC portal token de A não retorna pele de B.  
4. Body `org_id` de B ignorado (contexto = membership).  
5. Token portal expirado / reuso plaintext.  
6. `ALLOW_PORTAL_SESSION_DEV` em Vercel production ignorado.  
7. Upload não-imagem no OCR / analise.  
8. Payload 10mb+ rejeitado.  
9. Prompt do cliente não altera system (“ignore instructions”).  
10. Webhook mesmo `webhook_event_id` → `duplicado: true`.  
11. Dois aplicados simultâneos no mesmo produto.  
12. CSV 2001 linhas recusado.  
13. CSV duplicado CPF incrementa `ignorados_duplicados`.  
14. Custo +20% gera `estoque.custo_aumentou` e card.  
15. Após P1: procedimento afetado aparece no alerta.  
16. Pele portal JSON sem `ia_preliminar`.  
17. Staff sem `financeiro:view` 403 na API.  
18. Catálogo permissões ausente em production → 500 (após P0-5).  
19. Grade semana cria horário na `agenda` (não `appointments`).  
20. Restore backup não apaga a outra org.

## Ambientes

Local reset · staging = clone schema · produção só smoke (`/api/health` + login).

QA live 1400: HTTP/páginas. **Complementar**, não substituto.
