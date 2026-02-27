/**
 * Modelos de mensagem — master define textos para lembrete, aniversário, marketing.
 * Placeholders: {nome_cliente}, {data}, {hora}, {nome_clinica}, {link_confirmar}
 */

import { getTipos, listTemplates, upsertTemplate } from "../services/message-templates.service.js";
import { toast } from "../ui/toast.js";
import { navigate } from "../core/spa.js";

const PLACEHOLDERS = [
  { key: "nome_cliente", desc: "Nome do cliente" },
  { key: "data", desc: "Data do agendamento (ex.: 05/02/2026)" },
  { key: "hora", desc: "Horário do agendamento" },
  { key: "nome_clinica", desc: "Nome da clínica (Empresa)" },
  { key: "link_confirmar", desc: "Link para o cliente confirmar presença (só em lembrete)" },
];

export async function init() {
  const container = document.getElementById("modelosMensagemContainer");
  if (!container) return;

  try {
    const [tipos, templates] = await Promise.all([Promise.resolve(getTipos()), listTemplates()]);
    const byTipo = (templates || []).reduce((acc, t) => {
      acc[t.tipo] = t;
      return acc;
    }, {});

    container.innerHTML = `
      <p class="modelos-mensagem-legenda">
        Use as variáveis entre chaves onde quiser. Exemplo: <code>Olá, {nome_cliente}! Seu horário é dia {data} às {hora}.</code>
      </p>
      <ul class="modelos-mensagem-placeholders">
        ${PLACEHOLDERS.map((p) => `<li><code>{${p.key}}</code> — ${p.desc}</li>`).join("")}
      </ul>
      <div class="modelos-mensagem-list">
        ${tipos.map((t) => {
          const tpl = byTipo[t.id] || {};
          const isEmailAssunto = t.id === "lembrete_email_assunto";
          const isEmailCorpo = t.id === "lembrete_email_corpo";
          const assuntoVal = tpl.subject ?? tpl.body ?? "";
          return `
          <div class="modelos-mensagem-card" data-tipo="${escapeAttr(t.id)}">
            <h4 class="modelos-mensagem-card-title">${escapeHtml(t.label)}</h4>
            <p class="modelos-mensagem-card-hint">${escapeHtml(t.placeholder)}</p>
            ${isEmailAssunto ? `<label>Assunto do e-mail</label><input type="text" class="modelos-mensagem-input modelos-mensagem-subject" value="${escapeAttr(assuntoVal)}" placeholder="Ex.: Lembrete: agendamento {data} às {hora} — {nome_clinica}"><input type="hidden" class="modelos-mensagem-textarea" value="">` : `
            <label>Texto</label>
            <textarea class="modelos-mensagem-textarea" rows="${isEmailCorpo ? 5 : 3}" placeholder="Deixe vazio para usar o texto padrão do sistema">${escapeHtml(tpl.body || "")}</textarea>`}
            <button type="button" class="btn-primary modelos-mensagem-save" data-tipo="${escapeAttr(t.id)}">Salvar</button>
          </div>`;
        }).join("")}
      </div>
      <p class="modelos-mensagem-back"><a href="#" data-view="master">← Voltar às Configurações</a></p>
    `;

    container.querySelectorAll(".modelos-mensagem-save").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const card = btn.closest(".modelos-mensagem-card");
        const tipo = btn.dataset.tipo;
        const textarea = card?.querySelector(".modelos-mensagem-textarea");
        const subjectEl = card?.querySelector(".modelos-mensagem-subject");
        const body = (textarea?.value ?? "").trim();
        const subject = (subjectEl?.value ?? "").trim() || null;
        try {
          await upsertTemplate({
            tipo,
            body: tipo === "lembrete_email_assunto" ? "" : body,
            subject: tipo === "lembrete_email_assunto" ? subject : (subject || null),
          });
          toast("Modelo salvo. Será usado na próxima vez que você enviar esse tipo de mensagem.");
        } catch (err) {
          toast(err?.message || "Erro ao salvar");
        }
      });
    });

    /* Link "Voltar às Configurações" (data-view="master") é tratado pelo SPA (bindMenu com delegação) */
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p class=\"modelos-mensagem-error\">Erro ao carregar. Verifique se você tem permissão de master.</p>";
  }
}

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function escapeAttr(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
