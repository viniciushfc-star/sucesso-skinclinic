# LGPD operacional (P1-10)

**Isto não é parecer jurídico nem declaração de conformidade.** A clínica continua responsável pelo tratamento, base legal, DPO/encarregado e prazos da lei.

## O que o produto faz

| Pedido do titular | Onde | O que acontece |
|-------------------|------|----------------|
| Acesso / portabilidade | Perfil do cliente → Dados e privacidade | JSON com cadastro e tabelas ligadas. **Não** inclui `ia_preliminar`. |
| Remover identidade | Mesmo bloco (`clientes:manage`) | Anonimiza nome, contato e CPF. Encerra sessão do portal. |

## O que **permanece** (prontuário)

A clínica precisa do histórico do que foi feito — respaldo em intercorrência:

- Anamnese e registros da ficha
- Fotos de evolução e análise de pele (arquivo clínico)
- Protocolos aplicados e pacotes
- Eventos / prontuário por data
- Rotina de skincare
- Agenda e financeiro

O cadastro fica como `Titular excluído`, estado arquivado, e-mail interno `erased…@lgpd.invalid`. O prontuário continua ligado a esse registro, sem nome real.

## O que some

- Identificadores de contato (nome, e-mail, telefone, CPF, foto de perfil do cadastro)
- Sessões do portal (o titular deixa de entrar)
- Rascunho interno `ia_preliminar` (não é documento clínico)
- Logs de WhatsApp daquele número (canal, não prontuário)

## Retenção (prática do produto)

- Pedidos ficam em `lgpd_requests` (export/erase + contagens, sem o JSON completo).
- Auditoria grava `lgpd.export` e `lgpd.erase`.

## Quem pode

Recepção, gestor e master (`clientes:manage`). Profissional com só `clientes:edit` não vê os botões.

## SQL

`supabase/migrations/20260921200000_p1_lgpd_titular.sql`
