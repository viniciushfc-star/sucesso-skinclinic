/**
 * Minha rotina de skincare — portal do cliente.
 * Só aparece se a clínica tiver liberado a rotina para o cliente.
 */

import { getSkincareRotinaByToken } from "./client-portal.service.js";
import { toast } from "./ui/toast.client.js";

const app = document.getElementById("app");

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export async function init() {
  if (!app) return;
  app.innerHTML = "<p>Carregando sua rotina…</p>";
  try {
    const rotina = await getSkincareRotinaByToken();
    if (!rotina || !rotina.conteudo?.trim()) {
      app.innerHTML = `
        <section class="client-header">
          <h2>Minha rotina de skincare</h2>
          <p class="client-hint">Nenhuma rotina liberada no momento. A clínica pode liberar após validar sua análise ou consulta.</p>
        </section>
        <p><a href="#dashboard">Voltar ao início</a></p>
      `;
      return;
    }
    const texto = rotina.conteudo.trim();
    app.innerHTML = `
      <section class="client-header">
        <h2>Minha rotina de skincare</h2>
        <p class="client-hint">Rotina liberada pela clínica para você acompanhar em casa.</p>
      </section>
      <section class="skincare-rotina-portal">
        <div class="skincare-rotina-conteudo">${texto.split("\n").map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</div>
        <button type="button" class="btn-primary" id="btnVoltarSkincare">Voltar ao início</button>
      </section>
    `;
    document.getElementById("btnVoltarSkincare").onclick = () => {
      window.location.hash = "#dashboard";
    };
  } catch (err) {
    console.error(err);
    toast(err?.message || "Erro ao carregar rotina.");
    app.innerHTML = `
      <section class="client-header">
        <h2>Minha rotina de skincare</h2>
        <p class="client-hint">Erro ao carregar. <button type="button" id="btnRetrySkincare">Tentar de novo</button></p>
      </section>
    `;
    document.getElementById("btnRetrySkincare")?.addEventListener("click", () => init());
  }
}
