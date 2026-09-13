# Onde estamos atrás em relação aos concorrentes

Comparativo com o que o mercado de **software para clínicas de estética** costuma oferecer (Clinicorp, Clairis, Clinicx, Esthetic Manager, Hexapp, Trinks, etc.) e onde o SkinClinic ainda está em desvantagem ou pode evoluir.

---

## 1. WhatsApp

| Concorrentes | SkinClinic hoje |
|--------------|------------------|
| Integração **centralizada**: envio direto pelo sistema, sem abrir o navegador. Automação de lembretes, confirmação de agenda e campanhas. Muitos usam API oficial (Meta Cloud API / BSP). | **Abre o WhatsApp (wa.me)** com a mensagem pronta — o usuário cola/copia ou envia manualmente. Não há envio automático nem confirmação de agenda pelo WhatsApp sem intervenção. |
| Atendimento e qualificação por WhatsApp (até IA 24/7 em alguns). | Não há bot/IA no WhatsApp; apenas atalho para abrir conversa. |

**Lacuna:** Falta **integração real** (API) para envio automático de lembretes, confirmação de horário e, se desejado, campanhas. A tabela `whatsapp_logs` existe no desenho mas hoje só registra “aberto_wa”.

---

## 2. App para celular (experiência mobile)

| Concorrentes | SkinClinic hoje |
|--------------|------------------|
| **App nativo** iOS/Android ou PWA bem divulgada (instalável, notificações push, uso offline leve). Acesso “no bolso” para agenda e cliente. | Uso no celular via **navegador** (responsivo). Não há PWA (sem `manifest.json` nem service worker) nem app nas lojas. |

**Lacuna:** Não há PWA instalável nem app nativo. Quem quer “abrir o app no celular” usa o navegador; notificações push dependem do que já existir no front (ex.: Web Push). Um **PWA mínimo** (manifest + service worker + “Adicionar à tela”) já colocaria o produto mais próximo do que o mercado espera.

---

## 3. Agenda e automação

| Concorrentes | SkinClinic hoje |
|--------------|------------------|
| **Agendamento 24/7** pelo cliente (link ou portal); **confirmação automática** por WhatsApp/SMS; lembretes automáticos; redução de no-show. | Agenda para a equipe; lembrete **copiado** (usuário cola no WhatsApp/e-mail). Portal do cliente com confirmação por token. Não há confirmação **automática** por canal (WhatsApp/SMS) sem o usuário enviar. |

**Lacuna:** Automação de lembretes e confirmações (sem “copiar e colar”). Quanto mais o cliente conseguir confirmar/remarcar sozinho e receber lembretes automáticos, mais próximo do padrão dos concorrentes.

---

## 4. Prontuário e documentos

| Concorrentes | SkinClinic hoje |
|--------------|------------------|
| Prontuário eletrônico com **assinatura digital** do cliente (termo de consentimento, etc.) integrada ao fluxo. Assinatura em contrato/orçamento. | Termo de consentimento e documentos existem (Documentos e termos, perfil do cliente). Tabela **anamnesis_assinaturas** no SQL (por registro). Não está claro se todo o fluxo de “cliente assina no dispositivo” está completo e visível como diferencial. |

**Lacuna:** Revisar se o fluxo de **assinatura digital** (cliente no portal ou no aparelho) está completo, visível e comunicado como “termo/consentimento assinado digitalmente”. Alguns concorrentes destacam isso na venda.

---

## 5. Financeiro e relatórios

| Concorrentes | SkinClinic hoje |
|--------------|------------------|
| DRE, relatórios gerenciais, dashboards de faturamento, projeção de caixa, indicadores por procedimento/profissional. | **Fluxo de caixa** (resumo), **contas a pagar**, **metas**, parcelamento, margem/comissão. Não há DRE formal nem relatórios gerenciais exportáveis (PDF/Excel) destacados. |

**Lacuna:** **DRE** e **relatórios gerenciais** (faturamento por período, por procedimento, por profissional) e exportação (PDF/Excel) são comuns nos concorrentes e ajudam na decisão do gestor.

---

## 6. Pacotes, sessões e fidelização

| Concorrentes | SkinClinic hoje |
|--------------|------------------|
| Venda de **pacotes** (ex.: 5 sessões) com controle de sessões consumidas; **planos de assinatura** ou clube de fidelidade. | Planos comerciais (proposta com procedimentos e valor); conceito de “plano” no dashboard. Não há módulo explícito de **pacote de sessões** (comprou 10, consumiu 3) nem assinatura recorrente. |

**Lacuna:** Módulo de **pacotes/sessões** (comprar N sessões, dar baixa por atendimento) e, se fizer sentido, **assinatura recorrente** (mensalidade para descontos/acessos). Isso é muito comum em clínicas de estética.

---

## 7. Telemedicina / vídeo

| Concorrentes | SkinClinic hoje |
|--------------|------------------|
| Consultas por **vídeo** integradas (agendar e abrir chamada no próprio sistema). | Não há vídeo integrado. |

**Lacuna:** Se a clínica quiser consultas à distância, hoje precisa de ferramenta externa. Integração com vídeo (ou link para Google Meet/Zoom por agendamento) seria um diferencial em relação a quem não tem.

---

## 8. Experiência do cliente (portal e self-service)

| Concorrentes | SkinClinic hoje |
|--------------|------------------|
| Cliente **agenda**, **confirma**, **remarca**, **paga** e vê **prontuário/resumo** pelo celular. Tudo em um só lugar. | **Portal do cliente** (portal.html) com fluxos por token: completar cadastro, termo de consentimento, dashboard, mensagens, análise de pele, skincare/rotina, confirmação de agendamento. Depende de tabelas/RPCs (client_records, client_protocols, etc.) e de integrações (ex.: confirmação automática por WhatsApp) para ficar no mesmo nível. |

**Lacuna:** Completar e estabilizar o portal (tabelas e RPCs em **FALTA-NO-BANCO.md** e **INTERLIGACAO.md**). Somar **automação** (lembretes e confirmação por WhatsApp) e, se possível, **pagamento** pelo portal (link de pagamento, assinatura).

---

## 9. Resumo prioritário (o que mais “pesa” na comparação)

1. **WhatsApp integrado** – envio e automação (lembretes, confirmação) sem depender de “copiar e colar”.
2. **App/PWA** – experiência “app no celular” (instalável, notificações).
3. **Pacotes e sessões** – venda de pacote (ex.: 10 sessões) e controle de consumo.
4. **DRE e relatórios gerenciais** – relatórios e exportação (PDF/Excel) para o gestor.
5. **Assinatura digital** – fluxo completo e visível (cliente assina termo/consentimento no dispositivo).
6. **Automação de agenda** – confirmação e lembretes automáticos (WhatsApp/SMS).
7. **Telemedicina/vídeo** – opcional, mas citado por vários concorrentes.

---

*Documento baseado no que o app já implementa (rotas, serviços, docs do repo) e em tendências de mercado para software de gestão de clínicas de estética (2024/2025).*
