import { toast } from "../ui/toast.js";
import { listProcedures } from "../services/procedimentos.service.js";
import { createMarketRadar, deleteMarketRadar, listMarketRadar } from "../services/market-radar.service.js";
import { compararPreco, copyComparacao, isFonteCompleta } from "../utils/market-radar.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function brl(n) {
  return `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
}

export async function init() {
  const listEl = document.getElementById("radarList");
  const emptyEl = document.getElementById("radarEmpty");
  const form = document.getElementById("radarForm");
  if (!listEl || !form) return;

  let procedures = [];
  try {
    procedures = await listProcedures(true);
  } catch (_) {
    procedures = [];
  }
  const procSelect = document.getElementById("radarProcedureId");
  if (procSelect) {
    procSelect.innerHTML =
      `<option value="">Nome livre abaixo</option>` +
      procedures.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    procSelect.onchange = () => {
      const p = procedures.find((x) => x.id === procSelect.value);
      const nome = document.getElementById("radarProcedimento");
      if (p && nome && !nome.value.trim()) nome.value = p.name || "";
    };
  }

  async function refresh() {
    let rows = [];
    try {
      rows = await listMarketRadar();
    } catch (e) {
      listEl.innerHTML = `<p class="view-hint">Rode o SQL market_radar_refs no Supabase para cadastrar referências. Sem fonte o radar não compara.</p>`;
      if (emptyEl) emptyEl.classList.add("hidden");
      return;
    }
    const visiveis = rows.filter(isFonteCompleta);
    if (!visiveis.length) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.classList.remove("hidden");
      return;
    }
    if (emptyEl) emptyEl.classList.add("hidden");
    listEl.innerHTML = visiveis
      .map((r) => {
        const proc = procedures.find((p) => p.id === r.procedure_id || p.name === r.procedimento);
        const clinic = proc?.valor_cobrado;
        const cmp = compararPreco(clinic, r.preco_min, r.preco_max);
        const copy = copyComparacao({
          posicao: cmp.posicao,
          fonte: r.fonte,
          regiao: r.regiao,
          dataRef: String(r.data_ref).slice(0, 10),
        });
        return `<article class="radar-card">
          <h3>${escapeHtml(r.procedimento)}</h3>
          <p>Faixa observada: ${brl(r.preco_min)} – ${brl(r.preco_max)}</p>
          <p>Fonte: ${escapeHtml(r.fonte)} · ${escapeHtml(r.regiao)} · ${escapeHtml(String(r.data_ref).slice(0, 10))}</p>
          <p>Método: ${escapeHtml(r.metodologia)} · confiança ${escapeHtml(r.confianca)} · n=${r.amostra}</p>
          <p class="radar-copy">${escapeHtml(copy)}</p>
          <button type="button" class="btn-secondary radar-del" data-id="${r.id}">Remover</button>
        </article>`;
      })
      .join("");
    listEl.querySelectorAll(".radar-del").forEach((btn) => {
      btn.onclick = async () => {
        try {
          await deleteMarketRadar(btn.dataset.id);
          toast("Referência removida.");
          refresh();
        } catch (e) {
          toast(e?.message || "Não foi possível remover.");
        }
      };
    });
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const procedureId = document.getElementById("radarProcedureId")?.value || null;
    const proc = procedures.find((p) => p.id === procedureId);
    try {
      await createMarketRadar({
        procedimento: document.getElementById("radarProcedimento")?.value || proc?.name,
        procedure_id: procedureId || null,
        regiao: document.getElementById("radarRegiao")?.value,
        preco_min: document.getElementById("radarMin")?.value,
        preco_max: document.getElementById("radarMax")?.value,
        fonte: document.getElementById("radarFonte")?.value,
        data_ref: document.getElementById("radarData")?.value,
        metodologia: document.getElementById("radarMetodo")?.value,
        confianca: document.getElementById("radarConfianca")?.value,
        amostra: document.getElementById("radarAmostra")?.value,
        notas: document.getElementById("radarNotas")?.value,
      });
      form.reset();
      toast("Referência salva. O radar só usa linha com fonte completa.");
      refresh();
    } catch (err) {
      toast(err?.message || "Não foi possível salvar.");
    }
  };

  refresh();
}
