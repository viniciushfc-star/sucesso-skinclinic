# Master como Configurações — ideias e estrutura

O **Master** hoje é a área restrita a quem tem role `master` (dono da organização). Faz sentido usar como **central de configurações** e informações importantes da clínica.

---

## Implementado (Configurações hoje)

| Card | Descrição | Ação |
|------|-----------|------|
| **Dados da empresa** | Nome, endereço, CNPJ, logo e salas. | Abrir → tela Empresa |
| **Planos** | Assinatura e planos da organização. | Abrir → tela Planos |
| **Backup** | Baixar backup completo ou restaurar dados. | Abrir → tela Backup |
| **Auditoria** | Registro de ações da equipe. | Abrir → tela Auditoria |
| **Equipe e convites** | Total de usuários, convites pendentes (aprovar), link para Equipe. | — |
| **Visão geral** | Métricas (clientes, agenda, faturamento) + comparativo de organizações. | — |

O menu lateral mostra **Configurações** (⚙️) em vez de "Master" para quem tem acesso.

---

## O que já existia antes (referência)

| Onde | O que é |
|------|--------|
| **Master** (menu) | Resumo de usuários, convites pendentes (aprovar), dashboard com métricas e comparativo entre clínicas. O HTML depende de elementos que estão em outras views ou em index.html — vale centralizar no próprio Master. |
| **Empresa** (menu) | Cadastro da empresa: nome, cidade, estado, logo, endereço, CNPJ, telefone, salas/cabines. É o “perfil” da organização. |
| **Planos** (menu) | Planos de **assinatura** (pagamento): listagem de planos (nome, preço) e botão “Assinar”. Não confundir com “Planos terapêuticos”, que ficam em Procedimentos. |

---

## Ideia: Master = Configurações (hub)

Transformar o Master em **Configurações**: uma única tela que reúne atalhos e blocos para tudo que é “configuração” e “visão geral” da organização.

### 1. Blocos / seções sugeridos

- **Dados da empresa**  
  - Link ou card que leva à tela **Empresa** (ou o formulário pode ser aberto/embedado aqui).  
  - Objetivo: deixar claro que “nome da clínica, endereço, CNPJ, logo, salas” ficam aqui.

- **Planos (assinatura)**  
  - Link ou card que leva à tela **Planos** (ou listagem resumida aqui + “Ver todos”).  
  - Objetivo: plano atual da organização e opção de trocar/assinar.

- **Equipe e convites**  
  - Manter o que já existe: total de usuários, lista de convites pendentes, aprovar.  
  - Pode ganhar um link “Ir para Equipe” para detalhes.

- **Comparativo / visão geral**  
  - Manter o comparativo entre clínicas (quando houver mais de uma org) e métricas resumidas (clientes, agenda, faturamento).  
  - Útil para quem administra várias unidades.

- **Outros (futuro)**  
  - Notificações por e-mail (ativar/desativar, preferências).  
  - Integrações (ex.: contabilidade, ERP).  
  - Backup agendado ou lembrete de backup.  
  - Dados para emissão de nota (quando implementar).  
  - Resumo no card “Dados da empresa” (ex.: nome da clínica + “3 salas”) carregado da API, com botão “Editar”.

### 2. Onde fica “Dados da empresa”

- **Opção A:** Manter a view **Empresa** no menu e, no Master (Configurações), um card “Dados da empresa” que **navega** para `data-view="empresa"`.  
- **Opção B:** Trazer o formulário de Empresa **para dentro** do Master, como primeira seção (evita dois itens de menu; tudo de configuração em um lugar).  
- **Opção C:** Manter Empresa no menu e, no Master, um **resumo** (nome, cidade, “X salas”) + botão “Editar” que navega para Empresa.

Recomendação: **Opção A** ou **C** para não duplicar lógica; Master como “hub” com links claros.

### 3. Onde fica “Planos”

- **Planos de assinatura** (o que hoje está em **Planos** no menu):  
  - Colocar **dentro** do Master como uma seção “Assinatura” ou “Planos”, ou  
  - Manter a view **Planos** no menu e, no Master, um card “Planos e assinatura” que **navega** para `data-view="planos"`.

Recomendação: card no Master que leva à tela Planos, para manter um único lugar com a lógica de assinatura.

### 4. Menu do sistema

- **Master** pode aparecer no menu como **“Configurações”** (ou “Master” para quem já está acostumado).  
- **Empresa** e **Planos** podem:  
  - Continuar no menu como hoje, **ou**  
  - Sair do menu e ser acessados **só** a partir do Master (Configurações).  

Se saírem do menu, a ordem sugerida no Master é: primeiro **Dados da empresa**, depois **Planos (assinatura)**, depois Equipe/convites e comparativo.

---

## Resumo da estrutura sugerida (Master = Configurações)

1. **Título:** “Configurações” (ou “Master”).
2. **Cards / blocos (nessa ordem):**
   - **Dados da empresa** — “Nome, endereço, CNPJ, logo e salas.” [Ir para Empresa]
   - **Planos** — “Assinatura e planos da organização.” [Ir para Planos]
   - **Equipe e convites** — Resumo (total de usuários) + lista de convites pendentes (aprovar) + [Ir para Equipe].
   - **Visão geral** — Métricas (clientes, agenda, faturamento) e tabela comparativa de clínicas (quando aplicável).

Assim, o “botão” Master vira a entrada única para **configurações e informações importantes**, e você tem um lugar definido para implementar e expandir (notificações, integrações, etc.) sem poluir o menu.
