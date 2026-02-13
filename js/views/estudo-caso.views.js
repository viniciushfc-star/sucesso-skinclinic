/**
 * Estudo de caso — casos anonimizados por protocolo, perguntas pertinentes e esclarecer dúvida após leitura.
 * Objetivo: profissional fazer perguntas para melhor resultado e, após ler artigo, esclarecer para aprender de verdade.
 */

import { getProtocolos } from "../services/protocolo-db.service.js";
import {
  listCasosByProtocolo,
  getAgregacaoPorProtocolo,
  createEstudoCaso,
  addPerguntaEstudoCaso,
  listPerguntasByCaso,
  esclarecerDuvida,
} from "../services/estudo-caso.service.js";
import { toast } from "../ui/toast.js";

const selectProtocolo = document.getElementById("estudoCasoProtocolo");
const divAgregacao = document.getElementById("estudoCasoAgregacao");
const divLista = document.getElementById("estudoCasoLista");
const btnRegistrar = document.getElementById("estudoCasoBtnRegistrar");
const btnEsclarecer = document.getElementById("estudoCasoBtnEsclarecer");
const resultEsclarecer = document.getElementById("estudoCasoEsclarecerResultado");
const temaEsclarecer = document.getElementById("estudoCasoEsclarecerTema");
const duvidaEsclarecer = document.getElementById("estudoCasoEsclarecerDuvida");

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function simpleMarkdownToHtml(md) {
  if (!md) return "";
  let s = String(md)
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_, text, url) => {
      const u = (url || "").trim();
      const safe = /^https?:\/\//i.test(u);
      return safe ? `<a href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(text || "")}</a>` : escapeHtml("[" + (text || "") + "](" + u + ")");
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
  return "<p>" + s + "</p>";
}

async function loadProtocols() {
  if (!selectProtocolo) return;
  const list = await getProtocolos().catch(() => []);
  selectProtocolo.innerHTML = '<option value="">— Selecione o protocolo —</option>' + list.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)}</option>`).join("");
}

async function loadCasos() {
  const protocoloId = selectProtocolo?.value?.trim();
  divLista.innerHTML = "";
  divAgregacao.classList.add("hidden");
  divAgregacao.innerHTML = "";
  if (!protocoloId) return;

  try {
    const agg = await getAgregacaoPorProtocolo(protocoloId);
    if (agg.total > 0) {
      divAgregacao.innerHTML = `<p class="estudo-caso-frase">${escapeHtml(agg.frase_tendencia)}</p><p class="estudo-caso-totais">Melhora: ${agg.por_resposta.melhora || 0} · Sem mudança: ${agg.por_resposta.sem_mudanca || 0} · Efeito adverso: ${agg.por_resposta.efeito_adverso || 0}</p>`;
      divAgregacao.classList.remove("hidden");
    }

    const casos = agg.casos || [];
    if (casos.length === 0) {
      divLista.innerHTML = "<p class=\"estudo-caso-empty\">Nenhum caso registrado para este protocolo. Use o formulário abaixo para registrar.</p>";
      return;
    }

    for (const c of casos) {
      const perguntas = await listPerguntasByCaso(c.id).catch(() => []);
      const card = document.createElement("div");
      card.className = "estudo-caso-card";
      card.dataset.casoId = c.id;
      const respLabel = { melhora: "Melhora", sem_mudanca: "Sem mudança", efeito_adverso: "Efeito adverso" }[c.resposta_observada] || c.resposta_observada;
      const tipoPeleLabel = c.tipo_pele ? (c.tipo_pele.charAt(0).toUpperCase() + c.tipo_pele.slice(1)) : "";
      const fototipoLabel = c.fototipo ? `Fototipo ${escapeHtml(c.fototipo)}` : "";
      const perfilParts = [tipoPeleLabel, fototipoLabel].filter(Boolean).join(" · ") || "—";
      card.innerHTML = `
        <div class="estudo-caso-card-header">
          <span class="estudo-caso-perfil">${perfilParts}</span>
          <span class="estudo-caso-queixa">${escapeHtml(c.queixa_principal || "—")}</span>
          <span class="estudo-caso-resposta">${escapeHtml(respLabel)}</span>
          ${c.n_sessoes ? `<span class="estudo-caso-sessoes">${c.n_sessoes} sessões</span>` : ""}
        </div>
        ${c.analise_pele_resumo ? `<p class="estudo-caso-analise"><strong>Análise de pele:</strong> ${escapeHtml(c.analise_pele_resumo)}</p>` : ""}
        ${c.observacao ? `<p class="estudo-caso-obs">${escapeHtml(c.observacao)}</p>` : ""}
        <div class="estudo-caso-perguntas-list" id="perguntas-${escapeHtml(c.id)}">
          ${perguntas.map((pq) => `
            <div class="estudo-caso-qa">
              <p class="estudo-caso-q"><strong>${pq.tipo === "esclarecer" ? "Esclarecer" : "Pergunta"}:</strong> ${escapeHtml(pq.pergunta)}</p>
              ${pq.resposta_ia ? `<div class="estudo-caso-a">${simpleMarkdownToHtml(pq.resposta_ia)}</div>` : ""}
            </div>
          `).join("")}
        </div>
        <div class="estudo-caso-actions">
          <label>Fazer pergunta pertinente</label>
          <textarea class="estudo-caso-input-pergunta" rows="2" placeholder="Ex.: Por que esse perfil respondeu bem? O que evitar nessa queixa?"></textarea>
          <button type="button" class="btn-secondary estudo-caso-btn-pergunta">Enviar pergunta</button>
          <label class="estudo-caso-label-esclarecer">Esclarecer dúvida após leitura</label>
          <input type="text" class="estudo-caso-input-artigo" placeholder="Sobre qual artigo ou tema é a dúvida?">
          <textarea class="estudo-caso-input-duvida" rows="2" placeholder="Ex.: Li o artigo e não entendi..."></textarea>
          <button type="button" class="btn-secondary estudo-caso-btn-esclarecer">Esclarecer dúvida</button>
        </div>
      `;

      const btnPergunta = card.querySelector(".estudo-caso-btn-pergunta");
      const inputPergunta = card.querySelector(".estudo-caso-input-pergunta");
      const btnEsclarecerCard = card.querySelector(".estudo-caso-btn-esclarecer");
      const inputArtigo = card.querySelector(".estudo-caso-input-artigo");
      const inputDuvida = card.querySelector(".estudo-caso-input-duvida");

      btnPergunta.addEventListener("click", async () => {
        const text = inputPergunta?.value?.trim();
        if (!text) { toast("Digite sua pergunta."); return; }
        btnPergunta.disabled = true;
        try {
          await addPerguntaEstudoCaso(c.id, text, null, "pergunta");
          toast("Pergunta registrada.");
          inputPergunta.value = "";
          const perguntasAtual = await listPerguntasByCaso(c.id);
          const last = perguntasAtual[perguntasAtual.length - 1];
          const container = card.querySelector(".estudo-caso-perguntas-list");
          if (container && last) {
            const qa = document.createElement("div");
            qa.className = "estudo-caso-qa";
            qa.innerHTML = `<p class="estudo-caso-q"><strong>Pergunta:</strong> ${escapeHtml(last.pergunta)}</p><div class="estudo-caso-a">${simpleMarkdownToHtml(last.resposta_ia || "")}</div>`;
            container.appendChild(qa);
          }
        } catch (err) {
          toast(err?.message || "Erro ao enviar pergunta", "error");
        }
        btnPergunta.disabled = false;
      });

      btnEsclarecerCard.addEventListener("click", async () => {
        const duvidaText = inputDuvida?.value?.trim();
        if (!duvidaText) { toast("Digite sua dúvida."); return; }
        btnEsclarecerCard.disabled = true;
        try {
          await addPerguntaEstudoCaso(c.id, duvidaText, inputArtigo?.value?.trim() || null, "esclarecer");
          toast("Dúvida registrada e resposta exibida abaixo.");
          inputDuvida.value = "";
          if (inputArtigo) inputArtigo.value = "";
          const perguntasAtual = await listPerguntasByCaso(c.id);
          const last = perguntasAtual[perguntasAtual.length - 1];
          const container = card.querySelector(".estudo-caso-perguntas-list");
          if (container && last) {
            const qa = document.createElement("div");
            qa.className = "estudo-caso-qa";
            qa.innerHTML = `<p class="estudo-caso-q"><strong>Esclarecer:</strong> ${escapeHtml(last.pergunta)}</p><div class="estudo-caso-a">${simpleMarkdownToHtml(last.resposta_ia || "")}</div>`;
            container.appendChild(qa);
          }
        } catch (err) {
          toast(err?.message || "Erro ao esclarecer", "error");
        }
        btnEsclarecerCard.disabled = false;
      });

      divLista.appendChild(card);
    }
  } catch (err) {
    console.error(err);
    divLista.innerHTML = "<p class=\"estudo-caso-error\">Erro ao carregar casos.</p>";
    toast(err?.message || "Erro ao carregar", "error");
  }
}

function bindRegistrar() {
  if (!btnRegistrar) return;
  btnRegistrar.onclick = async () => {
    const protocoloId = selectProtocolo?.value?.trim();
    const resposta = document.getElementById("estudoCasoResposta")?.value?.trim();
    if (!protocoloId || !resposta) {
      toast("Selecione o protocolo e a resposta observada.");
      return;
    }
    const payload = {
      protocoloId,
      tipo_pele: document.getElementById("estudoCasoTipoPele")?.value?.trim() || null,
      fototipo: document.getElementById("estudoCasoFototipo")?.value?.trim() || null,
      queixa_principal: document.getElementById("estudoCasoQueixa")?.value?.trim() || null,
      resposta_observada: resposta,
      n_sessoes: document.getElementById("estudoCasoNSessoes")?.value?.trim() || null,
      observacao: document.getElementById("estudoCasoObservacao")?.value?.trim() || null,
      analise_pele_resumo: document.getElementById("estudoCasoAnalisePele")?.value?.trim() || null,
    };
    btnRegistrar.disabled = true;
    try {
      await createEstudoCaso(payload);
      toast("Caso registrado (anonimizado).");
      const el = (id) => document.getElementById(id);
      if (el("estudoCasoTipoPele")) el("estudoCasoTipoPele").value = "";
      if (el("estudoCasoFototipo")) el("estudoCasoFototipo").value = "";
      if (el("estudoCasoQueixa")) el("estudoCasoQueixa").value = "";
      if (el("estudoCasoResposta")) el("estudoCasoResposta").value = "";
      if (el("estudoCasoNSessoes")) el("estudoCasoNSessoes").value = "";
      if (el("estudoCasoObservacao")) el("estudoCasoObservacao").value = "";
      if (el("estudoCasoAnalisePele")) el("estudoCasoAnalisePele").value = "";
      loadCasos();
    } catch (err) {
      toast(err?.message || "Erro ao registrar", "error");
    }
    btnRegistrar.disabled = false;
  };
}

function bindEsclarecerGlobal() {
  if (!btnEsclarecer || !resultEsclarecer) return;
  btnEsclarecer.onclick = async () => {
    const duvida = duvidaEsclarecer?.value?.trim();
    if (!duvida) { toast("Descreva sua dúvida."); return; }
    btnEsclarecer.disabled = true;
    resultEsclarecer.classList.remove("hidden");
    resultEsclarecer.innerText = "Esclarecendo…";
    try {
      const resposta = await esclarecerDuvida(temaEsclarecer?.value?.trim() || null, duvida);
      resultEsclarecer.innerText = resposta;
    } catch (err) {
      resultEsclarecer.innerText = "Erro: " + (err?.message || "não foi possível esclarecer.");
      toast(err?.message || "Erro", "error");
    }
    btnEsclarecer.disabled = false;
  };
}

export async function init() {
  await loadProtocols();
  if (selectProtocolo) {
    selectProtocolo.addEventListener("change", loadCasos);
  }
  bindRegistrar();
  bindEsclarecerGlobal();
}
