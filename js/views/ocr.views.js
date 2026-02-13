/**
 * Notas fiscais — apenas emissão (link para sistema da prefeitura/contador).
 * Para ler nota de compra e dar entrada no estoque, use Estoque → Ler nota fiscal.
 */

import { getOrganizationProfile } from "../services/organization-profile.service.js";
import { navigate } from "../core/spa.js";

export async function init() {
  const container = document.getElementById("view-ocr");
  const ocrEmitirLink = document.getElementById("ocrEmitirLink");
  const ocrEmitirPlaceholder = document.getElementById("ocrEmitirPlaceholder");

  if (!container) return;

  try {
    const profile = await getOrganizationProfile();
    const url = (profile.nota_fiscal_emitir_url || "").trim();
    if (url && /^https?:\/\//i.test(url)) {
      if (ocrEmitirLink) {
        ocrEmitirLink.href = url;
        ocrEmitirLink.textContent = "Abrir sistema de emissão";
        ocrEmitirLink.classList.remove("hidden");
      }
      if (ocrEmitirPlaceholder) ocrEmitirPlaceholder.classList.add("hidden");
    } else {
      if (ocrEmitirLink) ocrEmitirLink.classList.add("hidden");
      if (ocrEmitirPlaceholder) ocrEmitirPlaceholder.classList.remove("hidden");
    }
  } catch (_) {
    if (ocrEmitirLink) ocrEmitirLink.classList.add("hidden");
    if (ocrEmitirPlaceholder) ocrEmitirPlaceholder.classList.remove("hidden");
  }

  ocrEmitirPlaceholder?.querySelector("a[data-view='empresa']")?.addEventListener("click", (e) => {
    e.preventDefault();
    navigate("empresa");
  });

  container.querySelector("a[data-view='estoque']")?.addEventListener("click", (e) => {
    e.preventDefault();
    navigate("estoque");
  });
}
