import {
  listPortalProcedures,
  listPortalBusyHours,
  listPortalAppointments,
  createPortalAppointment,
  reschedulePortalAppointment,
  cancelPortalAppointment,
  buildFreeSlots
} from "./agenda-portal.service.js";
import { toast } from "./ui/toast.client.js";

const app = document.getElementById("app");

export async function init() {
  await render();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtData(d) {
  if (!d) return "";
  const [y, m, day] = String(d).slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

async function render(remarcarId = null) {
  if (!app) return;
  app.innerHTML = "<p>Carregando agenda…</p>";
  let procedures = [];
  let mine = [];
  try {
    [procedures, mine] = await Promise.all([listPortalProcedures(), listPortalAppointments()]);
  } catch (err) {
    app.innerHTML = `
      <section class="client-header">
        <h2>Agendar horário</h2>
        <p class="client-hint">${escapeHtml(err?.message || "A clínica ainda não liberou o agendamento online. Peça para rodar o SQL supabase-portal-agendamento.sql.")}</p>
        <p><a href="#dashboard">← Voltar</a></p>
      </section>`;
    return;
  }

  const minDate = new Date().toISOString().slice(0, 10);
  const procOpts = procedures
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}${p.duration_minutes ? ` (${p.duration_minutes} min)` : ""}</option>`)
    .join("");

  const lista = mine.length
    ? `<ul class="portal-agenda-list">${mine
        .map(
          (a) => `<li>
            <strong>${escapeHtml(fmtData(a.data))} às ${escapeHtml(String(a.hora).slice(0, 5))}</strong>
            — ${escapeHtml(a.procedure_name || a.procedimento || "Atendimento")}
            <button type="button" class="btn-secondary btn-portal-remarcar" data-id="${escapeHtml(a.id)}" data-data="${escapeHtml(String(a.data).slice(0, 10))}">Remarcar</button>
            <button type="button" class="btn-secondary btn-portal-cancelar" data-id="${escapeHtml(a.id)}">Cancelar</button>
          </li>`
        )
        .join("")}</ul>`
    : `<p class="client-hint">Você não tem horários futuros.</p>`;

  app.innerHTML = `
    <section class="client-header">
      <h2>${remarcarId ? "Remarcar horário" : "Agendar horário"}</h2>
      <p class="client-hint">Escolha o procedimento, o dia e um horário livre. A clínica confirma a sala e o profissional.</p>
      <p><a href="#dashboard">← Voltar ao painel</a></p>
    </section>
    <section class="portal-agenda client-completar-cadastro">
      ${remarcarId ? `<input type="hidden" id="portalRemarcarId" value="${escapeHtml(remarcarId)}">` : `
      <label for="portalProc">Procedimento</label>
      <select id="portalProc">${procOpts || "<option value=\"\">Nenhum procedimento cadastrado</option>"}</select>`}
      <label for="portalData">Data</label>
      <input type="date" id="portalData" min="${minDate}" value="${minDate}">
      <p id="portalSlotsHint" class="client-hint">Carregando horários…</p>
      <div id="portalSlots" class="portal-agenda-slots"></div>
      ${lista}
    </section>
  `;

  await refreshSlots();
  document.getElementById("portalData").onchange = () => refreshSlots();
  app.querySelectorAll(".btn-portal-remarcar").forEach((btn) => {
    btn.onclick = () => render(btn.dataset.id);
  });
  app.querySelectorAll(".btn-portal-cancelar").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Cancelar este horário?")) return;
      try {
        await cancelPortalAppointment(btn.dataset.id);
        toast("Horário cancelado.");
        render();
      } catch (e) {
        toast(e?.message || "Não foi possível cancelar.");
      }
    };
  });
}

async function refreshSlots() {
  const dateEl = document.getElementById("portalData");
  const wrap = document.getElementById("portalSlots");
  const hint = document.getElementById("portalSlotsHint");
  if (!dateEl || !wrap) return;
  const dateYmd = dateEl.value;
  try {
    const busy = await listPortalBusyHours(dateYmd);
    const free = buildFreeSlots(busy, dateYmd);
    hint.textContent = free.length ? "Toque em um horário livre:" : "Nenhum horário neste dia. Tente outra data.";
    wrap.innerHTML = free
      .map((h) => `<button type="button" class="portal-slot" data-hora="${h}">${h}</button>`)
      .join("");
    wrap.querySelectorAll(".portal-slot").forEach((btn) => {
      btn.onclick = () => onPickSlot(dateYmd, btn.dataset.hora);
    });
  } catch (e) {
    hint.textContent = e?.message || "Erro ao carregar horários.";
    wrap.innerHTML = "";
  }
}

async function onPickSlot(data, hora) {
  const remarcarId = document.getElementById("portalRemarcarId")?.value;
  try {
    if (remarcarId) {
      await reschedulePortalAppointment({ agendaId: remarcarId, data, hora: hora.length === 5 ? `${hora}:00` : hora });
      toast("Horário remarcado.");
    } else {
      const procedureId = document.getElementById("portalProc")?.value;
      if (!procedureId) {
        toast("Selecione um procedimento.");
        return;
      }
      await createPortalAppointment({ data, hora: hora.length === 5 ? `${hora}:00` : hora, procedureId });
      toast("Horário solicitado. A clínica vê na agenda.");
    }
    await render();
  } catch (e) {
    toast(e?.message || "Não foi possível agendar.");
  }
}
