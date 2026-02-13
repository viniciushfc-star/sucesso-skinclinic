/**
 * Calendário de conteúdo: lista, criar, editar, aprovar, rejeitar, agendar.
 * Ao abrir, processa agendados vencidos (marca publicado e notifica).
 */

import {
  listConteudoCalendario,
  createConteudoCalendario,
  updateConteudoCalendario,
  getConteudoCalendario,
  enviarParaAprovacao,
  aprovarConteudo,
  rejeitarConteudo,
  agendarConteudo,
  desagendarConteudo,
  marcarPublicado,
  processarAgendadosVencidos
} from "../services/conteudo-calendario.service.js";
import { toast } from "../ui/toast.js";
import { openModal, closeModal, openConfirmModal } from "../ui/modal.js";

const CANAIS = [
  { value: "geral", label: "Geral" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "outro", label: "Outro" }
];

const STATUS_LABEL = {
  rascunho: "Rascunho",
  em_aprovacao: "Em aprovação",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  agendado: "Agendado",
  publicado: "Publicado"
};

function escapeHtml(s) {
  if (!s) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export async function init() {
  try {
    const n = await processarAgendadosVencidos();
    if (n > 0) toast(`${n} post(s) agendado(s) processado(s). Verifique as notificações.`);
  } catch (e) {
    console.warn("[CALENDARIO] processar agendados", e);
  }
  bindUI();
  await renderList();
}

function bindUI() {
  const btnNovo = document.getElementById("calendarioConteudoBtnNovo");
  const filtroStatus = document.getElementById("calendarioConteudoFiltro");
  if (btnNovo) btnNovo.onclick = () => openFormModal();
  if (filtroStatus) filtroStatus.onchange = () => renderList();
}

async function renderList() {
  const listEl = document.getElementById("listaCalendarioConteudo");
  const filtroEl = document.getElementById("calendarioConteudoFiltro");
  if (!listEl) return;

  const filtro = filtroEl?.value || "";
  try {
    const items = await listConteudoCalendario(filtro || null);
    listEl.innerHTML = items.length === 0
      ? '<p class="calendario-conteudo-empty">Nenhum conteúdo. Crie um rascunho ou cole a sugestão do Copilot de Marketing.</p>'
      : items.map((item) => renderCard(item)).join("");

    listEl.querySelectorAll("[data-action]").forEach((btn) => {
      btn.onclick = () => handleAction(btn.dataset.action, btn.dataset.id);
    });
  } catch (err) {
    console.error("[CALENDARIO]", err);
    toast(err.message || "Erro ao carregar calendário.");
    listEl.innerHTML = '<p class="calendario-conteudo-empty">Erro ao carregar.</p>';
  }
}

function renderCard(item) {
  const titulo = item.titulo ? escapeHtml(item.titulo) : "(sem título)";
  const preview = (item.conteudo || "").slice(0, 120) + ((item.conteudo || "").length > 120 ? "…" : "");
  const statusClass = "calendario-status-" + (item.status || "rascunho");
  const statusLabel = STATUS_LABEL[item.status] || item.status;
  const agendado = item.status === "agendado" && item.agendado_para
    ? formatDateTime(item.agendado_para)
    : "";

  let botoes = "";
  if (item.status === "rascunho" || item.status === "rejeitado") {
    botoes += `<button type="button" class="btn-secondary btn-sm" data-action="edit" data-id="${item.id}">Editar</button>`;
    botoes += `<button type="button" class="btn-primary btn-sm" data-action="enviarAprovacao" data-id="${item.id}">Enviar para aprovação</button>`;
  }
  if (item.status === "em_aprovacao") {
    botoes += `<button type="button" class="btn-primary btn-sm" data-action="aprovar" data-id="${item.id}">Aprovar</button>`;
    botoes += `<button type="button" class="btn-secondary btn-sm" data-action="rejeitar" data-id="${item.id}">Rejeitar</button>`;
  }
  if (item.status === "aprovado") {
    botoes += `<button type="button" class="btn-primary btn-sm" data-action="agendar" data-id="${item.id}">Agendar publicação</button>`;
    botoes += `<button type="button" class="btn-secondary btn-sm" data-action="marcarPublicado" data-id="${item.id}">Marcar como publicado</button>`;
  }
  if (item.status === "agendado") {
    botoes += `<button type="button" class="btn-secondary btn-sm" data-action="desagendar" data-id="${item.id}">Desagendar</button>`;
    botoes += `<button type="button" class="btn-primary btn-sm" data-action="marcarPublicado" data-id="${item.id}">Marcar como publicado</button>`;
  }
  if (item.status === "rascunho" || item.status === "rejeitado") {
    botoes += `<button type="button" class="btn-secondary btn-sm btn-danger" data-action="delete" data-id="${item.id}">Excluir</button>`;
  }

  return `
    <div class="calendario-conteudo-card" data-id="${item.id}">
      <div class="calendario-conteudo-card-header">
        <span class="calendario-conteudo-titulo">${titulo}</span>
        <span class="calendario-conteudo-status ${statusClass}">${statusLabel}</span>
        ${agendado ? `<span class="calendario-conteudo-agendado">📅 ${agendado}</span>` : ""}
      </div>
      <p class="calendario-conteudo-preview">${escapeHtml(preview)}</p>
      <div class="calendario-conteudo-actions">${botoes}</div>
    </div>
  `;
}

async function handleAction(action, id) {
  try {
    switch (action) {
      case "edit":
        await openFormModal(id);
        break;
      case "enviarAprovacao":
        await enviarParaAprovacao(id);
        toast("Enviado para aprovação.");
        await renderList();
        break;
      case "aprovar":
        await aprovarConteudo(id);
        toast("Conteúdo aprovado.");
        await renderList();
        break;
      case "rejeitar":
        await openRejeitarModal(id);
        break;
      case "agendar":
        await openAgendarModal(id);
        break;
      case "desagendar":
        await desagendarConteudo(id);
        toast("Agendamento removido.");
        await renderList();
        break;
      case "marcarPublicado":
        await marcarPublicado(id);
        toast("Marcado como publicado.");
        await renderList();
        break;
      case "delete":
        openConfirmModal("Excluir conteúdo?", "Excluir este conteúdo?", async () => {
          const { supabase } = await import("../core/supabase.js");
          const { getActiveOrg } = await import("../core/org.js");
          await supabase.from("conteudo_calendario").delete().eq("id", id).eq("org_id", getActiveOrg());
          toast("Excluído.");
          await renderList();
        });
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("[CALENDARIO]", err);
    toast(err.message || "Erro na ação.");
  }
}

function openFormModal(editId = null, prefillConteudo = null) {
  const isEdit = !!editId;
  const canalOptions = CANAIS.map((c) => `<option value="${c.value}">${c.label}</option>`).join("");

  const fields = `
    <label>Título (opcional)</label>
    <input type="text" id="calModalTitulo" placeholder="Ex.: Post promoção verão">
    <label>Conteúdo do post <small>(pode colar a sugestão do Copilot de Marketing)</small></label>
    <textarea id="calModalConteudo" rows="6" placeholder="Cole ou escreva o texto do post..."></textarea>
    <label>Canal</label>
    <select id="calModalCanal">${canalOptions}</select>
  `;

  openModal(
    isEdit ? "Editar conteúdo" : "Novo conteúdo",
    fields,
    async () => {
      const titulo = document.getElementById("calModalTitulo")?.value?.trim() || null;
      const conteudo = document.getElementById("calModalConteudo")?.value?.trim() || "";
      if (!conteudo) {
        toast("Preencha o conteúdo.");
        return;
      }
      if (isEdit) {
        await updateConteudoCalendario(editId, { titulo, conteudo, canal: document.getElementById("calModalCanal")?.value || "geral" });
        toast("Conteúdo atualizado.");
      } else {
        await createConteudoCalendario({ titulo, conteudo, canal: document.getElementById("calModalCanal")?.value || "geral" });
        toast("Conteúdo criado. Envie para aprovação quando estiver pronto.");
      }
      closeModal();
      await renderList();
    },
    null
  );

  if (prefillConteudo) {
    const conteudoEl = document.getElementById("calModalConteudo");
    if (conteudoEl) conteudoEl.value = prefillConteudo;
  }

  if (isEdit && !prefillConteudo) {
    getConteudoCalendario(editId).then((item) => {
      const tituloEl = document.getElementById("calModalTitulo");
      const conteudoEl = document.getElementById("calModalConteudo");
      const canalEl = document.getElementById("calModalCanal");
      if (tituloEl) tituloEl.value = item.titulo || "";
      if (conteudoEl) conteudoEl.value = item.conteudo || "";
      if (canalEl) canalEl.value = item.canal || "geral";
    }).catch((e) => toast(e.message));
  }
}

function openFormModalWithContent(conteudo) {
  openFormModal(null, conteudo);
}

function openRejeitarModal(id) {
  const fields = `
    <label>Motivo da rejeição (opcional)</label>
    <textarea id="calModalMotivoRejeicao" rows="3" placeholder="Ex.: Ajustar tom, refazer texto..."></textarea>
  `;
  openModal(
    "Rejeitar conteúdo",
    fields,
    async () => {
      const motivo = document.getElementById("calModalMotivoRejeicao")?.value?.trim() || "";
      await rejeitarConteudo(id, motivo);
      toast("Conteúdo rejeitado.");
      closeModal();
      await renderList();
    },
    null
  );
}

function openAgendarModal(id) {
  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 16);
  const fields = `
    <label>Data e hora da publicação</label>
    <input type="datetime-local" id="calModalAgendadoPara" value="${defaultDate}">
    <p class="calendario-conteudo-hint">No horário agendado o sistema marcará como publicado e enviará uma notificação com o conteúdo para você publicar manualmente.</p>
  `;
  openModal(
    "Agendar publicação",
    fields,
    async () => {
      const val = document.getElementById("calModalAgendadoPara")?.value;
      if (!val) {
        toast("Informe data e hora.");
        return;
      }
      await agendarConteudo(id, val);
      toast("Publicação agendada.");
      closeModal();
      await renderList();
    },
    null
  );
}
