/**
 * Análise de Pele por IA (MVP) — view do dashboard (clínica).
 * Lista análises pendentes; ao abrir uma: imagens, respostas, IA preliminar; validar e/ou incorporar à Anamnese (Pele).
 */

import {
  listAnalisesPele,
  getAnalisePeleById,
  validarAnalisePele,
  incorporarAnalisePeleNaAnamnese,
} from "../services/analise-pele.service.js";
import { toast } from "../ui/toast.js";

const listaEl = document.getElementById("analisePeleLista");
const detalheEl = document.getElementById("analisePeleDetalhe");

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export async function init() {
  if (!listaEl) return;
  listaEl.innerHTML = "<p>Carregando…</p>";
  detalheEl?.classList.add("hidden");
  detalheEl && (detalheEl.innerHTML = "");

  try {
    const list = await listAnalisesPele("pending_validation");
    if (list.length === 0) {
      listaEl.innerHTML = "<p class=\"analise-pele-empty\">Nenhuma análise pendente. As enviadas pelo portal aparecem aqui.</p>";
      return;
    }
    listaEl.innerHTML = `
      <ul class="analise-pele-cards">
        ${list
          .map(
            (a) => `
          <li class="analise-pele-card" data-id="${a.id}">
            <strong>${escapeHtml(a.clients?.name || "Cliente")}</strong>
            <small>${new Date(a.created_at).toLocaleString("pt-BR")}</small>
            <button type="button" class="btn-small btn-ver-analise">Ver e validar</button>
          </li>
        `
          )
          .join("")}
      </ul>
    `;
    listaEl.querySelectorAll(".btn-ver-analise").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.closest("[data-id]")?.dataset?.id;
        if (id) openDetalhe(id);
      });
    });
  } catch (err) {
    console.error("[ANALISE-PELE]", err);
    toast(err.message || "Erro ao carregar análises.");
    listaEl.innerHTML = "<p>Erro ao carregar.</p>";
  }
}

async function openDetalhe(id) {
  if (!detalheEl) return;
  detalheEl.innerHTML = "<p>Carregando…</p>";
  detalheEl.classList.remove("hidden");

  try {
    const a = await getAnalisePeleById(id);
    const clienteNome = a.clients?.name || "Cliente";
    const imagensHtml =
      Array.isArray(a.imagens) && a.imagens.length > 0
        ? a.imagens
            .map(
              (url) =>
                `<img src="${escapeHtml(url)}" alt="Foto" class="analise-pele-img" loading="lazy">`
            )
            .join("")
        : "<p>Sem fotos.</p>";
    const respostasHtml =
      a.respostas && typeof a.respostas === "object"
        ? Object.entries(a.respostas)
            .filter(([, v]) => v != null && String(v).trim())
            .map(([k, v]) => `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</p>`)
            .join("")
        : "";

    detalheEl.innerHTML = `
      <div class="analise-pele-detalhe-header">
        <h3>${escapeHtml(clienteNome)}</h3>
        <small>${new Date(a.created_at).toLocaleString("pt-BR")}</small>
        <button type="button" id="btnFecharDetalhe" class="btn-secondary">Fechar</button>
      </div>
      <div class="analise-pele-detalhe-imagens">
        <h4>Fotos</h4>
        <div class="analise-pele-imagens-wrap">${imagensHtml}</div>
      </div>
      <div class="analise-pele-detalhe-respostas">
        <h4>Respostas do cliente</h4>
        ${respostasHtml || "<p>Nenhuma.</p>"}
      </div>
      <div class="analise-pele-detalhe-ia">
        <h4>Análise preliminar (IA)</h4>
        <div class="analise-pele-ia-texto">${escapeHtml(a.ia_preliminar || "").replace(/\n/g, "<br>")}</div>
      </div>
      <div class="analise-pele-detalhe-validacao">
        <label>Texto validado / complemento (opcional)</label>
        <textarea id="analisePeleTextoValidado" rows="4" placeholder="Correções ou complementos do profissional…">${escapeHtml(a.texto_validado || "")}</textarea>
      </div>
      <div class="analise-pele-detalhe-actions">
        <button type="button" id="btnValidar" class="btn-primary">Validar análise</button>
        ${
          a.status === "incorporated"
            ? "<p class=\"analise-pele-incorporated\">Já incorporada à Anamnese (Pele).</p>"
            : `<button type="button" id="btnIncorporar" class="btn-secondary">${a.status === "validated" ? "Incorporar à Anamnese (Pele)" : "Validar e incorporar à Anamnese (Pele)"}</button>`
        }
      </div>
    `;

    document.getElementById("btnFecharDetalhe")?.addEventListener("click", () => {
      detalheEl.classList.add("hidden");
      init();
    });

    document.getElementById("btnValidar")?.addEventListener("click", async () => {
      const texto = document.getElementById("analisePeleTextoValidado")?.value?.trim() || null;
      try {
        await validarAnalisePele(id, texto);
        toast("Análise validada.");
        openDetalhe(id);
        init();
      } catch (e) {
        toast(e.message || "Erro ao validar.");
      }
    });

    const btnIncorporar = document.getElementById("btnIncorporar");
    if (btnIncorporar) {
      btnIncorporar.addEventListener("click", async () => {
        const texto = document.getElementById("analisePeleTextoValidado")?.value?.trim() || null;
        try {
          if (a.status !== "validated") {
            await validarAnalisePele(id, texto);
          }
          await incorporarAnalisePeleNaAnamnese(id);
          toast("Incorporado à Anamnese (Pele).");
          detalheEl.classList.add("hidden");
          init();
        } catch (e) {
          toast(e.message || "Erro ao incorporar.");
        }
      });
    }
  } catch (err) {
    console.error("[ANALISE-PELE]", err);
    toast(err.message || "Erro ao carregar análise.");
    detalheEl.classList.add("hidden");
  }
}
