import { supabase } from "../core/supabase.js";
import { buildFreeSlots } from "../Client/agenda-portal.service.js";

const app = document.getElementById("agendarApp");
const params = new URLSearchParams(window.location.search);
const orgId = params.get("org") || "";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function boot() {
  if (!orgId) {
    app.innerHTML = "<p>Link inválido. Peça o link de agendamento para a clínica.</p>";
    return;
  }
  const { data: clinic, error } = await supabase.rpc("get_public_clinic", { p_org_id: orgId });
  const row = clinic?.[0];
  if (error || !row) {
    app.innerHTML = `<p>Não foi possível abrir a agenda. A clínica precisa rodar o SQL <code>supabase-agenda-publica.sql</code>.</p>
      <p class="agendar-hint">${escapeHtml(error?.message || "")}</p>`;
    return;
  }
  const { data: procedures, error: errP } = await supabase.rpc("list_public_procedures", { p_org_id: orgId });
  if (errP) {
    app.innerHTML = `<p>${escapeHtml(errP.message)}</p>`;
    return;
  }
  const minDate = new Date().toISOString().slice(0, 10);
  const opts = (procedures || [])
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
    .join("");
  app.innerHTML = `
    ${row.logo_url ? `<img class="agendar-logo" src="${escapeHtml(row.logo_url)}" alt="">` : ""}
    <h1>${escapeHtml(row.name || "Agendar")}</h1>
    <p class="agendar-hint">Escolha o serviço, seu nome e um horário.</p>
    <label>Seu nome</label>
    <input type="text" id="pubNome" autocomplete="name" required>
    <label>WhatsApp</label>
    <input type="tel" id="pubPhone" autocomplete="tel" placeholder="DDD + número" required>
    <label>Procedimento</label>
    <select id="pubProc">${opts || "<option value=\"\">Indisponível</option>"}</select>
    <label>Data</label>
    <input type="date" id="pubData" min="${minDate}" value="${minDate}">
    <p id="pubHint" class="agendar-hint">Carregando horários…</p>
    <div id="pubSlots" class="agendar-slots"></div>
  `;
  document.getElementById("pubData").onchange = loadSlots;
  await loadSlots();
}

async function loadSlots() {
  const dateYmd = document.getElementById("pubData")?.value;
  const wrap = document.getElementById("pubSlots");
  const hint = document.getElementById("pubHint");
  if (!dateYmd || !wrap) return;
  const { data, error } = await supabase.rpc("list_public_busy_hours", { p_org_id: orgId, p_data: dateYmd });
  if (error) {
    hint.textContent = error.message;
    wrap.innerHTML = "";
    return;
  }
  const busy = (data || []).map((r) => String(r.hora).slice(0, 5));
  const free = buildFreeSlots(busy, dateYmd);
  hint.textContent = free.length ? "Toque no horário:" : "Sem horário neste dia.";
  wrap.innerHTML = free.map((h) => `<button type="button" class="agendar-slot" data-hora="${h}">${h}</button>`).join("");
  wrap.querySelectorAll(".agendar-slot").forEach((btn) => {
    btn.onclick = () => book(dateYmd, btn.dataset.hora);
  });
}

async function book(data, hora) {
  const name = document.getElementById("pubNome")?.value?.trim();
  const phone = document.getElementById("pubPhone")?.value?.trim();
  const procedureId = document.getElementById("pubProc")?.value;
  if (!name || !phone || !procedureId) {
    alert("Preencha nome, WhatsApp e procedimento.");
    return;
  }
  const { error } = await supabase.rpc("create_public_appointment", {
    p_org_id: orgId,
    p_name: name,
    p_phone: phone,
    p_data: data,
    p_hora: hora.length === 5 ? `${hora}:00` : hora,
    p_procedure_id: procedureId
  });
  if (error) {
    alert(error.message || "Não foi possível agendar.");
    return;
  }
  app.innerHTML = `<div class="agendar-ok"><h1>Pedido enviado</h1><p>A clínica recebeu seu horário em <strong>${hora}</strong>. Se precisar remarcar, fale com eles no WhatsApp.</p></div>`;
}

boot();
