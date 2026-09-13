/**
 * Anamnese à distância — o cliente preenche a ficha no portal; a clínica vê no dashboard.
 */
import { submitAnamneseByToken, listAnamnesePortalByToken } from "./client-portal.service.js";
import { toast } from "./ui/toast.client.js";
import { PORTAL_FICHA_CAMPOS, PORTAL_FUNCAO_OPCOES } from "../constants/anamnese-portal-ficha.js";

const app = document.getElementById("app");

export async function init() {
  renderForm();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fieldHtml(c) {
  const id = "portal_ficha_" + c.key;
  if (c.type === "select") {
    const opts = (c.options || []).map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join("");
    return `<label for="${id}">${escapeHtml(c.label)}</label><select id="${id}" data-ficha-key="${c.key}"><option value="">—</option>${opts}</select>`;
  }
  if (c.type === "sim_nao") {
    return `<label for="${id}">${escapeHtml(c.label)}</label><select id="${id}" data-ficha-key="${c.key}"><option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option></select>`;
  }
  if (c.type === "sim_nao_complement") {
    return `<label for="${id}">${escapeHtml(c.label)}</label><select id="${id}" data-ficha-key="${c.key}"><option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option></select><input type="text" id="${id}_complement" data-ficha-key="${c.key}_complement" placeholder="${escapeHtml(c.complementPlaceholder || "Qual?")}">`;
  }
  if (c.type === "textarea") {
    return `<label for="${id}">${escapeHtml(c.label)}</label><textarea id="${id}" data-ficha-key="${c.key}" rows="2" placeholder="${escapeHtml(c.placeholder || "")}"></textarea>`;
  }
  return `<label for="${id}">${escapeHtml(c.label)}</label><input type="text" id="${id}" data-ficha-key="${c.key}" placeholder="${escapeHtml(c.placeholder || "")}">`;
}

function collectFicha(slug) {
  const campos = PORTAL_FICHA_CAMPOS[slug] || [];
  const ficha = {};
  for (const c of campos) {
    const el = document.querySelector(`[data-ficha-key="${c.key}"]`);
    if (!el) continue;
    const val = (el.value || "").trim();
    if (val) ficha[c.key] = val;
    if (c.type === "sim_nao_complement") {
      const extra = document.querySelector(`[data-ficha-key="${c.key}_complement"]`);
      const extraVal = (extra?.value || "").trim();
      if (extraVal) ficha[c.key + "_complement"] = extraVal;
    }
  }
  return ficha;
}

async function renderForm(slug = "rosto_pele") {
  if (!app) return;
  let historico = [];
  try {
    historico = await listAnamnesePortalByToken();
  } catch (_) {
    historico = [];
  }
  const campos = PORTAL_FICHA_CAMPOS[slug] || PORTAL_FICHA_CAMPOS.rosto_pele;
  const opts = PORTAL_FUNCAO_OPCOES.map(
    (o) => `<option value="${o.slug}"${o.slug === slug ? " selected" : ""}>${escapeHtml(o.label)}</option>`
  ).join("");
  const histHtml = historico.length
    ? `<ul class="portal-anamnese-hist">${historico
        .map(
          (h) =>
            `<li>${escapeHtml(new Date(h.created_at).toLocaleString("pt-BR"))} — ${escapeHtml(h.funcao_nome || h.funcao_slug)} (enviada)</li>`
        )
        .join("")}</ul>`
    : `<p class="client-hint">Você ainda não enviou ficha por aqui.</p>`;

  app.innerHTML = `
    <section class="client-header">
      <h2>Anamnese à distância</h2>
      <p class="client-hint">Preencha com calma em casa. A clínica recebe no prontuário e o profissional confirma na consulta. Isso não substitui a avaliação presencial.</p>
      <p><a href="#dashboard">← Voltar ao painel</a></p>
    </section>
    <section class="portal-anamnese client-completar-cadastro">
      <label for="portalAnamneseArea">Área</label>
      <select id="portalAnamneseArea">${opts}</select>
      <div id="portalAnamneseCampos">${campos.map(fieldHtml).join("")}</div>
      <label for="portalAnamneseObs">Observações livres (opcional)</label>
      <textarea id="portalAnamneseObs" rows="3" placeholder="Algo que a clínica deva saber antes do atendimento…"></textarea>
      <button type="button" id="btnEnviarAnamnesePortal" class="btn-primary">Enviar para a clínica</button>
      <h3>Já enviadas</h3>
      ${histHtml}
    </section>
  `;

  document.getElementById("portalAnamneseArea").onchange = (e) => {
    renderForm(e.target.value);
  };
  document.getElementById("btnEnviarAnamnesePortal").onclick = async () => {
    const area = document.getElementById("portalAnamneseArea").value;
    const ficha = collectFicha(area);
    if (!Object.keys(ficha).length) {
      toast("Preencha pelo menos um campo da ficha.");
      return;
    }
    const obs = document.getElementById("portalAnamneseObs")?.value || "";
    try {
      await submitAnamneseByToken({ funcao_slug: area, ficha, observacoes: obs });
      toast("Ficha enviada. A clínica já pode ver no prontuário.");
      renderForm(area);
    } catch (err) {
      console.error("[PORTAL ANAMNESE]", err);
      toast(err?.message || "Não foi possível enviar. Peça à clínica para rodar o SQL da anamnese no portal.");
    }
  };
}
