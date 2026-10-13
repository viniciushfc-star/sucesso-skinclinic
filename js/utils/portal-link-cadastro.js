/**
 * Link do portal atrelado à ficha. Sem senha. Clínica envia; WhatsApp não sai sozinho.
 */

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

export function htmlCheckLinkPortalCadastro() {
  return `<label class="form-check"><input type="checkbox" id="gerarLinkPortalCadastro" checked> Gerar link do portal desta pessoa (você envia; WhatsApp não sai daqui)</label>`;
}

export function querLinkPortalNoCadastro() {
  try {
    const el = document.getElementById("gerarLinkPortalCadastro");
    if (!el) return true;
    return !!el.checked;
  } catch (_) {
    return true;
  }
}

export function htmlPortalLinkPronto({ url = "", nome = "" } = {}) {
  const n = String(nome || "esta pessoa").slice(0, 80);
  const u = String(url || "");
  return `
    <p class="client-hint">Este link é só da ficha de <strong>${escapeHtml(n)}</strong>. Sem senha. Você envia (WhatsApp, SMS). O sistema não dispara mensagem.</p>
    <label for="portalLinkUrl">Link</label>
    <input id="portalLinkUrl" type="text" readonly value="${escapeHtml(u)}">
    <p class="form-hint">Se expirar, gere outro na ficha. Continua a mesma pessoa.</p>
    <button type="button" class="btn-primary" id="btnCopiarLinkPortal">Copiar link</button>
  `;
}

export async function copiarTextoPortal(url) {
  const t = String(url || "").trim();
  if (!t) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch (_) {
    /* fallback no clique */
  }
  const el = document.getElementById("portalLinkUrl");
  if (el) {
    el.focus();
    el.select();
    try {
      return document.execCommand("copy");
    } catch (_) {
      return false;
    }
  }
  return false;
}

export function bindPortalLinkPronto(toast, url) {
  document.getElementById("btnCopiarLinkPortal")?.addEventListener("click", async () => {
    const ok = await copiarTextoPortal(url || document.getElementById("portalLinkUrl")?.value);
    if (ok) toast("Link copiado. Envie você mesma. WhatsApp não sai daqui.");
    else toast("Selecione o link e copie (Ctrl+C).");
  });
}

export function mostrarLinkPortalCadastro({ url, nome } = {}, { toast, onClose, openModal } = {}) {
  const u = String(url || "").trim();
  if (!u) {
    onClose?.();
    return;
  }
  if (typeof openModal !== "function") {
    onClose?.();
    return;
  }
  openModal(
    "Link do portal",
    htmlPortalLinkPronto({ url: u, nome }),
    () => {},
    onClose,
    { hideSubmit: true }
  );
  bindPortalLinkPronto(toast, u);
}
