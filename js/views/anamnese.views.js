/**
 * Ficha de Anamnese — por área/queixa (Capilar, Rosto Pele/Injetáveis, Corporal).
 * Ficha vinculada à dor do cliente; fotos e conduta do tratamento.
 * @see .cursor/rules/anamnese-canon.mdc
 */

import { supabase } from "../core/supabase.js";
import { navigate } from "../core/spa.js";
import { toast } from "../ui/toast.js";
import { getClientes } from "../services/clientes.service.js";
import {
  listFuncoes,
  suggestFuncaoFromProcedimento,
  listRegistrosByClientAndFuncao,
  createRegistro,
  uploadFotoAnamnese,
  updateResultadoResumo
} from "../services/anamnesis.service.js";

const STORAGE_AGENDA = "anamnese_agenda_id";
const STORAGE_CLIENT = "anamnese_client_id";
const STORAGE_PROCEDIMENTO = "anamnese_procedimento";

/** Tipos de campo: section (título), text, textarea, select, sim_nao, sim_nao_complement */
function renderFichaField(c, escapeHtml) {
  const id = "ficha_" + c.key;
  if (c.type === "section") {
    return `<h4 class="anamnese-ficha-section">${escapeHtml(c.label)}</h4>`;
  }
  if (c.type === "select") {
    const opts = (c.options || []).map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join("");
    return `<label for="${id}">${escapeHtml(c.label)}</label><select id="${id}" data-ficha-key="${c.key}"><option value="">—</option>${opts}</select>`;
  }
  if (c.type === "sim_nao") {
    return `<label for="${id}">${escapeHtml(c.label)}</label><select id="${id}" data-ficha-key="${c.key}"><option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option></select>`;
  }
  if (c.type === "sim_nao_complement") {
    const complementId = id + "_complement";
    const complementPlaceholder = c.complementPlaceholder || "Qual? / Por quê? / Há quanto tempo?";
    return `<label for="${id}">${escapeHtml(c.label)}</label><select id="${id}" data-ficha-key="${c.key}"><option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option></select><input type="text" id="${complementId}" data-ficha-key="${c.key}_complement" placeholder="${escapeHtml(complementPlaceholder)}" class="anamnese-ficha-complement">`;
  }
  if (c.type === "textarea") {
    return `<label for="${id}">${escapeHtml(c.label)}</label><textarea id="${id}" data-ficha-key="${c.key}" placeholder="${escapeHtml(c.placeholder || "")}" rows="2"></textarea>`;
  }
  return `<label for="${id}">${escapeHtml(c.label)}</label><input type="text" id="${id}" data-ficha-key="${c.key}" placeholder="${escapeHtml(c.placeholder || "")}">`;
}

/** Zonas do mapa facial para injetáveis (áreas de aplicação) — documento visual atrelado ao registro */
const FACE_ZONAS = [
  { id: "testa", label: "Testa" },
  { id: "glabella", label: "Glabela" },
  { id: "orbicular_olho", label: "Orbicular do olho (pés de galinha)" },
  { id: "frontal_lateral", label: "Frontal lateral" },
  { id: "malar", label: "Malar" },
  { id: "nariz", label: "Nariz" },
  { id: "labios", label: "Lábios" },
  { id: "mandibula", label: "Mandíbula" },
  { id: "queixo", label: "Queixo" },
  { id: "outras", label: "Outras (descreva na observação)" }
];

/** Campos da ficha por área/queixa — questionários profissionalizados (corporal, facial, injetáveis) */
const FICHA_CAMPOS = {
  capilar: [
    { key: "queixa_principal", label: "Queixa principal", type: "textarea", placeholder: "Ex.: queda, oleosidade, caspa…" },
    { key: "tipo_cabelo", label: "Tipo de cabelo", type: "text", placeholder: "Ex.: liso, cacheado, químico…" },
    { key: "condicao_couro", label: "Condição do couro cabeludo", type: "text", placeholder: "Ex.: sensível, oleoso…" },
    { key: "produtos_uso", label: "Produtos em uso", type: "textarea", placeholder: "Shampoo, condicionador, outros…" }
  ],
  rosto_pele: [
    { key: "sec_facial", label: "Questionário — Facial (pele)", type: "section" },
    { key: "atividade_profissional", label: "Atividade profissional", type: "text", placeholder: "Ex.: escritório, comércio…" },
    { key: "cep", label: "CEP", type: "text", placeholder: "00000-000" },
    { key: "ambiente_trabalho", label: "Ambiente de trabalho", type: "select", options: [{ value: "interno", label: "Interno" }, { value: "externo", label: "Externo" }] },
    { key: "afecacao_interesse", label: "Qual afecção estética tem interesse de tratar?", type: "textarea", placeholder: "Ex.: melasma, acne, oleosidade…" },
    { key: "ja_tratamento_facial", label: "Já fez algum tratamento facial?", type: "sim_nao_complement", complementPlaceholder: "Qual?" },
    { key: "resultado_atendeu", label: "O resultado atendeu seus objetivos?", type: "sim_nao_complement", complementPlaceholder: "Por quê?" },
    { key: "usa_acidos_peelings", label: "Usa ácidos (peelings)?", type: "sim_nao_complement", complementPlaceholder: "Há quanto tempo?" },
    { key: "toxina_botulinica", label: "Fez recentemente toxina botulínica?", type: "sim_nao_complement", complementPlaceholder: "Há quanto tempo?" },
    { key: "preenchimentos", label: "Preenchimentos?", type: "sim_nao_complement", complementPlaceholder: "Há quanto tempo?" },
    { key: "depilacao_laser_cera_facial", label: "Depilação a laser ou cera na região facial?", type: "sim_nao_complement", complementPlaceholder: "Há quanto tempo?" },
    { key: "filtro_solar_diario", label: "Utiliza filtro solar diariamente?", type: "sim_nao" },
    { key: "alergias_cremes", label: "Alergias a cremes/loções?", type: "sim_nao_complement", complementPlaceholder: "Quais?" },
    { key: "problema_pele", label: "Apresenta algum problema de pele?", type: "sim_nao_complement", complementPlaceholder: "Qual?" },
    { key: "gestante", label: "Está grávida ou suspeita de gestação?", type: "sim_nao_complement", complementPlaceholder: "Quanto tempo de gestação?" },
    { key: "ciclo_menstrual", label: "Ciclo menstrual normal? Menopausa?", type: "text", placeholder: "Ex.: regular; não menopausa" },
    { key: "dum", label: "DUM (dia da última menstruação)", type: "text", placeholder: "DD/MM/AAAA" },
    { key: "contraceptivo", label: "Utiliza contraceptivo?", type: "sim_nao_complement", complementPlaceholder: "Qual?" },
    { key: "lente_contato", label: "Usa lente de contato?", type: "sim_nao" },
    { key: "cirurgia_recente", label: "Cirurgia recente?", type: "sim_nao_complement", complementPlaceholder: "Qual?" },
    { key: "marca_passo", label: "Portador de marca-passo?", type: "sim_nao" },
    { key: "pinos_placas", label: "Portador de pinos ou placas?", type: "sim_nao" },
    { key: "diabetico", label: "É diabético(a)?", type: "sim_nao" },
    { key: "epiletico", label: "É epilético(a)?", type: "sim_nao" },
    { key: "fumante", label: "Fumante?", type: "sim_nao_complement", complementPlaceholder: "Quantos maços por dia?" },
    { key: "ingestao_agua", label: "Ingestão de água por dia", type: "select", options: [{ value: "2_4_copos", label: "2 a 4 copos" }, { value: "3_5_copos", label: "3 a 5 copos" }, { value: "5_7_copos", label: "5 a 7 copos" }, { value: "mais_2l", label: "Mais de 2 L" }, { value: "menos_2l", label: "Menos de 2 L" }] },
    { key: "tumor_lesao_cancerosa", label: "Tumor ou lesão cancerosa?", type: "sim_nao_complement", complementPlaceholder: "Local?" },
    { key: "medicacao_habitual", label: "Medicação habitual?", type: "sim_nao_complement", complementPlaceholder: "Qual?" },
    { key: "doenca_transmissivel_sangue", label: "Doença transmissível pelo sangue (HIV, hepatite, sífilis)?", type: "sim_nao_complement", complementPlaceholder: "Qual?" },
    { key: "skincare", label: "Faz skincare?", type: "sim_nao_complement", complementPlaceholder: "Pela manhã / à noite (relate)" },
    { key: "outras_informacoes", label: "Outras informações que gostaria de relatar", type: "textarea", placeholder: "Alguma informação não citada acima…" }
  ],
  rosto_injetaveis: [
    { key: "queixa_principal", label: "Queixa principal", type: "textarea", placeholder: "Ex.: preenchimento, harmonização…" },
    { key: "historico_preenchimentos", label: "Histórico de preenchimentos / toxina", type: "textarea", placeholder: "Quando, onde, produto…" },
    { key: "alergias", label: "Alergias / contraindicações", type: "textarea", placeholder: "Ex.: ácido hialurônico, anestésico…" },
    { key: "areas_aplicacao_obs", label: "Marque no desenho ao lado as áreas de aplicação (respaldo visual).", type: "section" }
  ],
  corporal: [
    { key: "sec_corporal", label: "Questionário — Corporal", type: "section" },
    { key: "atividade_profissional", label: "Qual a sua atividade profissional?", type: "text", placeholder: "Ex.: escritório, comércio…" },
    { key: "cep", label: "CEP", type: "text", placeholder: "00000-000" },
    { key: "ambiente_trabalho", label: "A atividade é executada no ambiente", type: "select", options: [{ value: "interno", label: "Interno" }, { value: "externo", label: "Externo" }] },
    { key: "afecacao_interesse", label: "Qual afecção estética tem interesse de tratar?", type: "textarea", placeholder: "Ex.: gordura localizada, flacidez, celulite…" },
    { key: "ja_tratamento_corporal", label: "Já fez algum tratamento corporal?", type: "sim_nao_complement", complementPlaceholder: "Qual?" },
    { key: "resultado_atendeu", label: "O resultado atendeu seus objetivos?", type: "sim_nao_complement", complementPlaceholder: "Por quê?" },
    { key: "pratica_atividade_fisica", label: "Pratica atividade física?", type: "sim_nao_complement", complementPlaceholder: "Com que frequência?" },
    { key: "outras_informacoes", label: "Outras informações que gostaria de relatar", type: "textarea", placeholder: "Histórico, cirurgias, hábitos…" }
  ]
};

export async function init() {
  const contextEl = document.getElementById("anamneseContext");
  const formWrap = document.getElementById("anamneseFormWrap");
  const semClienteEl = document.getElementById("anamneseSemCliente");
  const tipoRegistroSelect = document.getElementById("anamneseTipoRegistro");
  const funcaoSelect = document.getElementById("anamneseFuncao");
  const fichaCamposWrap = document.getElementById("anamneseFichaCamposWrap");
  const fichaCamposEl = document.getElementById("anamneseFichaCampos");
  const conteudoEl = document.getElementById("anamneseConteudo");
  const fotosInput = document.getElementById("anamneseFotos");
  const fotosPreviewEl = document.getElementById("anamneseFotosPreview");
  const condutaEl = document.getElementById("anamneseConduta");
  const btnSalvar = document.getElementById("btnAnamneseSalvar");
  const registrosEl = document.getElementById("anamneseRegistros");

  if (!formWrap || !registrosEl) return;

  const agendaId = sessionStorage.getItem(STORAGE_AGENDA);
  const procedimento = sessionStorage.getItem(STORAGE_PROCEDIMENTO) || "";
  const clienteSelect = document.getElementById("anamneseClienteSelect");

  let clientList = [];
  try {
    clientList = await getClientes({}) || [];
  } catch (e) {
    console.error("[ANAMNESE] getClientes", e);
    toast("Erro ao carregar lista de clientes.");
  }
  if (clienteSelect) {
    const currentStored = sessionStorage.getItem(STORAGE_CLIENT) || "";
    clienteSelect.innerHTML = "<option value=\"\">— Selecione o cliente —</option>" +
      clientList.map((c) => `<option value="${escapeHtml(c.id)}"${c.id === currentStored ? " selected" : ""}>${escapeHtml(c.name || c.nome || "—")}</option>`).join("");
  }

  let currentClientId = sessionStorage.getItem(STORAGE_CLIENT) || "";

  function renderWithClient(id) {
    currentClientId = id || "";
    sessionStorage.setItem(STORAGE_CLIENT, currentClientId || "");
    if (clienteSelect) clienteSelect.value = currentClientId || "";

    if (!currentClientId) {
      semClienteEl?.classList.remove("hidden");
      semClienteEl.innerHTML = "<p>Selecione um cliente no campo acima para acessar a ficha e o histórico.</p>";
      formWrap.classList.add("hidden");
      if (contextEl) contextEl.classList.add("hidden");
      registrosEl.innerHTML = "";
      return;
    }

    semClienteEl?.classList.add("hidden");
    formWrap.classList.remove("hidden");
    contextEl?.classList.remove("hidden");
    contextEl.innerHTML = `
    <p><strong>Cliente:</strong> <span id="anamneseClientName">—</span></p>
    ${procedimento ? `<p><strong>Atendimento:</strong> ${escapeHtml(procedimento)}</p>` : ""}
    ${agendaId ? "<p class=\"anamnese-context-from-agenda\">Contexto deste atendimento (agenda).</p>" : ""}
  `;
    loadClientName(currentClientId, document.getElementById("anamneseClientName"));
    loadRegistros();
  }

  if (clienteSelect) {
    clienteSelect.addEventListener("change", () => {
      renderWithClient(clienteSelect.value || "");
    });
  }

  if (!currentClientId) {
    semClienteEl?.classList.remove("hidden");
    semClienteEl.innerHTML = "<p>Selecione um cliente no campo acima para acessar a ficha e o histórico.</p>";
    formWrap.classList.add("hidden");
    if (contextEl) contextEl.classList.add("hidden");
    registrosEl.innerHTML = "";
  } else {
    semClienteEl?.classList.add("hidden");
    formWrap.classList.remove("hidden");
    contextEl?.classList.remove("hidden");
    contextEl.innerHTML = `
    <p><strong>Cliente:</strong> <span id="anamneseClientName">—</span></p>
    ${procedimento ? `<p><strong>Atendimento:</strong> ${escapeHtml(procedimento)}</p>` : ""}
    ${agendaId ? "<p class=\"anamnese-context-from-agenda\">Contexto deste atendimento (agenda).</p>" : ""}
  `;
    loadClientName(currentClientId, document.getElementById("anamneseClientName"));
  }

  let funcoes = [];
  try {
    funcoes = await listFuncoes();
  } catch (e) {
    console.error("[ANAMNESE] listFuncoes", e);
    toast("Erro ao carregar áreas.");
    return;
  }

  const funcaoFromSlug = sessionStorage.getItem("anamnese_funcao_slug") || null;
  if (funcaoFromSlug) sessionStorage.removeItem("anamnese_funcao_slug");
  const suggestedSlug = funcaoFromSlug || suggestFuncaoFromProcedimento(procedimento);
  funcaoSelect.innerHTML = funcoes.map((f) => {
    const selected = suggestedSlug && f.slug === suggestedSlug ? " selected" : "";
    return `<option value="${f.id}" data-slug="${escapeHtml(f.slug)}"${selected}>${escapeHtml(f.nome)}</option>`;
  }).join("");

  function getSlugSelected() {
    const opt = funcaoSelect.options[funcaoSelect.selectedIndex];
    return opt?.dataset?.slug || "";
  }

  function renderFichaCampos(slug) {
    const campos = FICHA_CAMPOS[slug] || [];
    fichaCamposEl.innerHTML = campos.map((c) => renderFichaField(c, escapeHtml)).join("");

    if (slug === "rosto_injetaveis") {
      const faceWrap = document.createElement("div");
      faceWrap.id = "anamneseFaceMapWrap";
      faceWrap.className = "anamnese-face-map-wrap";
      faceWrap.innerHTML = `
        <p class="anamnese-face-map-title">Marque as áreas de aplicação (respaldo documental)</p>
        <div class="anamnese-face-map" id="anamneseFaceMap" role="group" aria-label="Áreas do rosto aplicadas">
          ${FACE_ZONAS.map((z) => `<button type="button" class="anamnese-face-zone" data-zone-id="${escapeHtml(z.id)}" title="${escapeHtml(z.label)}">${escapeHtml(z.label)}</button>`).join("")}
        </div>
      `;
      fichaCamposEl.appendChild(faceWrap);
      faceWrap.querySelectorAll(".anamnese-face-zone").forEach((btn) => {
        btn.addEventListener("click", () => {
          btn.classList.toggle("selected");
        });
      });
    }
  }

  function getFichaFromForm(slug) {
    const campos = FICHA_CAMPOS[slug] || [];
    const ficha = {};
    for (const c of campos) {
      if (c.type === "section") continue;
      const el = document.getElementById("ficha_" + c.key);
      if (el && el.value != null && String(el.value).trim()) ficha[c.key] = String(el.value).trim();
      if (c.type === "sim_nao_complement") {
        const compEl = document.getElementById("ficha_" + c.key + "_complement");
        if (compEl && compEl.value && compEl.value.trim()) ficha[c.key + "_complement"] = compEl.value.trim();
      }
    }
    if (slug === "rosto_injetaveis") {
      const selected = Array.from(document.querySelectorAll("#anamneseFaceMapWrap .anamnese-face-zone.selected")).map((b) => b.dataset.zoneId).filter(Boolean);
      if (selected.length) ficha.areas_aplicacao = selected;
    }
    return ficha;
  }

  function setFichaInForm(slug, ficha) {
    if (!ficha || typeof ficha !== "object") return;
    for (const key of Object.keys(ficha)) {
      const el = document.getElementById("ficha_" + key);
      if (el) el.value = ficha[key] != null ? String(ficha[key]) : "";
    }
    if (slug === "rosto_injetaveis" && Array.isArray(ficha.areas_aplicacao)) {
      document.querySelectorAll("#anamneseFaceMapWrap .anamnese-face-zone").forEach((btn) => {
        btn.classList.toggle("selected", ficha.areas_aplicacao.includes(btn.dataset.zoneId));
      });
    }
  }

  function isModoEvolucao() {
    return tipoRegistroSelect && tipoRegistroSelect.value === "evolucao";
  }

  function toggleFichaVisivel() {
    if (fichaCamposWrap) fichaCamposWrap.classList.toggle("hidden", isModoEvolucao());
    if (btnSalvar) btnSalvar.textContent = isModoEvolucao() ? "Registrar evolução" : "Salvar ficha";
  }

  function onFuncaoChange() {
    renderFichaCampos(getSlugSelected());
  }

  if (tipoRegistroSelect) tipoRegistroSelect.addEventListener("change", toggleFichaVisivel);
  funcaoSelect.addEventListener("change", onFuncaoChange);
  onFuncaoChange();
  toggleFichaVisivel();

  fotosInput.addEventListener("change", () => {
    fotosPreviewEl.innerHTML = "";
    const files = fotosInput.files;
    if (!files?.length) return;
    for (let i = 0; i < Math.min(files.length, 6); i++) {
      const fr = new FileReader();
      fr.onload = () => {
        const img = document.createElement("img");
        img.src = fr.result;
        img.className = "anamnese-foto-thumb";
        fotosPreviewEl.appendChild(img);
      };
      fr.readAsDataURL(files[i]);
    }
  });

  async function loadRegistros() {
    const funcaoId = funcaoSelect.value;
    if (!funcaoId || !currentClientId) return;
    try {
      const list = await listRegistrosByClientAndFuncao(currentClientId, funcaoId);
      registrosEl.innerHTML = list.length === 0
        ? "<p class=\"anamnese-empty\">Nenhum registro ainda para esta área. O histórico é evolutivo.</p>"
        : list.map((r) => renderRegistroItem(r)).join("");
      bindCompare(list);
    } catch (e) {
      console.error("[ANAMNESE] listRegistros", e);
      registrosEl.innerHTML = "<p class=\"anamnese-empty\">Erro ao carregar histórico.</p>";
    }
  }

  function fichaEntryToHtml(k, v) {
    const label = k === "areas_aplicacao" ? "Áreas aplicação" : k.replace(/_/g, " ");
    let val = v;
    if (k === "areas_aplicacao" && Array.isArray(v)) {
      val = v.map((id) => FACE_ZONAS.find((z) => z.id === id)?.label || id).join(", ") || "—";
    } else if (Array.isArray(v)) {
      val = v.join(", ");
    }
    return "<p><strong>" + escapeHtml(label) + ":</strong> " + escapeHtml(String(val)) + "</p>";
  }

  function renderRegistroItem(r) {
    const data = r.created_at ? new Date(r.created_at).toLocaleString("pt-BR") : "";
    let body = "";
    if (r.ficha && Object.keys(r.ficha).length > 0) {
      body += "<div class=\"anamnese-registro-ficha\">" + Object.entries(r.ficha).map(([k, v]) => fichaEntryToHtml(k, v)).join("") + "</div>";
    }
    if (r.conteudo && r.conteudo.trim()) body += "<div class=\"anamnese-registro-conteudo\">" + escapeHtml(r.conteudo) + "</div>";
    if (r.conduta_tratamento && r.conduta_tratamento.trim()) body += "<div class=\"anamnese-registro-conduta\"><strong>Conduta:</strong> " + escapeHtml(r.conduta_tratamento) + "</div>";
    if (r.resultado_resumo && r.resultado_resumo.trim()) body += "<div class=\"anamnese-registro-resultado\"><strong>Resumo do resultado:</strong> " + escapeHtml(r.resultado_resumo) + "</div>";
    if (r.fotos && r.fotos.length > 0) {
      body += "<div class=\"anamnese-registro-fotos\">" + r.fotos.map((url) => `<img src="${escapeHtml(url)}" alt="" class="anamnese-foto-thumb">`).join("") + "</div>";
    }
    if (!body) body = "<span class=\"anamnese-empty-line\">—</span>";
    return `<div class="anamnese-registro" data-id="${escapeHtml(r.id)}"><div class="anamnese-registro-header"><span class="anamnese-registro-data">${escapeHtml(data)}</span><label class="anamnese-compare-label"><input type="checkbox" class="anamnese-compare-checkbox" data-id="${escapeHtml(r.id)}"> Comparar</label></div>${body}</div>`;
  }

  function bindCompare(list) {
    const compareWrap = document.getElementById("anamneseCompareWrap");
    if (!compareWrap) return;
    let selectedIds = [];
    function renderCompare() {
      if (selectedIds.length !== 2) {
        compareWrap.classList.add("hidden");
        compareWrap.innerHTML = "";
        return;
      }
      const [idA, idB] = selectedIds;
      const regA = list.find((r) => r.id === idA);
      const regB = list.find((r) => r.id === idB);
      if (!regA || !regB) {
        compareWrap.classList.add("hidden");
        compareWrap.innerHTML = "";
        return;
      }
      // Ordena para que o mais antigo fique em \"Antes\" e o mais recente em \"Depois\"
      const dateA = new Date(regA.created_at || 0);
      const dateB = new Date(regB.created_at || 0);
      const [before, after, beforeDate, afterDate] =
        dateA <= dateB ? [regA, regB, dateA, dateB] : [regB, regA, dateB, dateA];

      const diffMs = afterDate.getTime() - beforeDate.getTime();
      const diffDays = diffMs > 0 ? Math.round(diffMs / (1000 * 60 * 60 * 24)) : 0;
      const sessoesPeriodo = list.filter((r) => {
        if (!r.created_at) return false;
        const d = new Date(r.created_at);
        return d >= beforeDate && d <= afterDate;
      }).length;
      compareWrap.classList.remove("hidden");
      compareWrap.innerHTML = `
        <h4 class="anamnese-compare-title">Comparativo antes / depois (esta área)</h4>
        <p class="anamnese-compare-hint">Selecione dois registros para ver lado a lado. Aqui aparecem apenas dados que já estão no prontuário (fotos, ficha, observações e conduta), para mostrar resultado real do que foi conquistado.</p>
        <div class="anamnese-compare-metrics">
          <p><strong>Período analisado:</strong> ${beforeDate.toLocaleDateString("pt-BR")} → ${afterDate.toLocaleDateString("pt-BR")} (${diffDays} dia(s))</p>
          <p><strong>Sessões registradas nesta área no período:</strong> ${sessoesPeriodo}</p>
          <p><strong>Total de registros desta área no prontuário:</strong> ${list.length}</p>
        </div>
        <div class="anamnese-compare-grid">
          ${renderCompareColumn("Antes", before)}
          ${renderCompareColumn("Depois", after)}
        </div>
        <label class="anamnese-compare-nota-label">
          <span>Texto de resultado (editável, opcional — para empresas que queiram usar isso em laudos, propostas ou materiais para o cliente):</span>
          <textarea class="anamnese-compare-nota" rows="3" placeholder="Ex.: Em 8 sessões, redução visível de manchas e textura mais uniforme da pele, mantendo padrão de segurança e acompanhamento.">${after.resultado_resumo ? escapeHtml(after.resultado_resumo) : ""}</textarea>
        </label>
        <div class="anamnese-compare-actions">
          <button type="button" class="anamnese-compare-save" data-id-depois="${escapeHtml(after.id)}">Salvar resumo no registro Depois</button>
          <button type="button" class="anamnese-compare-print">Gerar relatório para impressão / PDF</button>
        </div>
      `;

      const btnSave = compareWrap.querySelector(".anamnese-compare-save");
      const notaEl = compareWrap.querySelector(".anamnese-compare-nota");
      const btnPrint = compareWrap.querySelector(".anamnese-compare-print");
      if (btnSave && notaEl) {
        btnSave.addEventListener("click", async () => {
          const texto = notaEl.value || "";
          try {
            await updateResultadoResumo(after.id, texto);
            toast("Resumo de resultado salvo no registro 'Depois'.");
          } catch (e) {
            console.error("[ANAMNESE] updateResultadoResumo", e);
            toast(e.message || "Erro ao salvar resumo de resultado.");
          }
        });
      }
      if (btnPrint && notaEl) {
        btnPrint.addEventListener("click", () => {
          const texto = notaEl.value || "";
          const clienteNomeEl = document.getElementById("anamneseClientName");
          const clienteNome = clienteNomeEl ? clienteNomeEl.textContent || "" : "";
          const funcaoOpt = funcaoSelect.options[funcaoSelect.selectedIndex];
          const areaNome = funcaoOpt ? funcaoOpt.textContent || "" : "";
          const fotosAntes = (before.fotos || []).slice(0, 4);
          const fotosDepois = (after.fotos || []).slice(0, 4);

          const win = window.open("", "_blank");
          if (!win) return;
          win.document.write(`<!DOCTYPE html>
<html lang=\"pt-BR\">
<head>
  <meta charset=\"utf-8\">
  <title>Relatório de evolução - ${clienteNome ? escapeHtml(clienteNome) : "Cliente"}</title>
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;font-size:12px;color:#111827;margin:24px;background:#fff;}
    h1{font-size:20px;margin:0 0 4px;}
    h2{font-size:16px;margin:16px 0 4px;}
    h3{font-size:14px;margin:12px 0 4px;}
    p{margin:2px 0;}
    .meta{margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;}
    .grid{display:flex;gap:16px;margin-top:8px;}
    .col{flex:1;min-width:0;border:1px solid #e5e7eb;border-radius:8px;padding:8px;}
    .label{font-weight:600;}
    .fotos{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;}
    .fotos img{width:90px;height:90px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;}
    .resumo{margin-top:10px;padding:8px;border-radius:8px;background:#f9fafb;border:1px solid #e5e7eb;}
    .footer{margin-top:16px;font-size:11px;color:#6b7280;}
  </style>
</head>
<body>
  <h1>Relatório de evolução / antes & depois</h1>
  <div class=\"meta\">
    <p><span class=\"label\">Cliente:</span> ${escapeHtml(clienteNome || "—")}</p>
    <p><span class=\"label\">Área / queixa:</span> ${escapeHtml(areaNome || "—")}</p>
    <p><span class=\"label\">Período:</span> ${beforeDate.toLocaleDateString("pt-BR")} → ${afterDate.toLocaleDateString("pt-BR")} (${diffDays} dia(s))</p>
    <p><span class=\"label\">Sessões registradas na área no período:</span> ${sessoesPeriodo}</p>
  </div>
  <div class=\"grid\">
    <div class=\"col\">
      <h2>Antes</h2>
      <p><span class=\"label\">Data:</span> ${beforeDate.toLocaleString("pt-BR")}</p>
      ${before.conteudo ? `<p><span class=\"label\">Observações:</span> ${escapeHtml(before.conteudo)}</p>` : ""}
      ${before.conduta_tratamento ? `<p><span class=\"label\">Conduta planejada na época:</span> ${escapeHtml(before.conduta_tratamento)}</p>` : ""}
      ${fotosAntes.length ? `<div class=\"fotos\">${fotosAntes.map((url) => `<img src=\"${escapeHtml(url)}\" alt=\"Antes\">`).join("")}</div>` : ""}
    </div>
    <div class=\"col\">
      <h2>Depois</h2>
      <p><span class=\"label\">Data:</span> ${afterDate.toLocaleString("pt-BR")}</p>
      ${after.conteudo ? `<p><span class=\"label\">Observações:</span> ${escapeHtml(after.conteudo)}</p>` : ""}
      ${after.conduta_tratamento ? `<p><span class=\"label\">Conduta nesta sessão:</span> ${escapeHtml(after.conduta_tratamento)}</p>` : ""}
      ${fotosDepois.length ? `<div class=\"fotos\">${fotosDepois.map((url) => `<img src=\"${escapeHtml(url)}\" alt=\"Depois\">`).join("")}</div>` : ""}
    </div>
  </div>
  <div class=\"resumo\">
    <h3>Resumo do resultado</h3>
    <p>${texto ? escapeHtml(texto) : "—"}</p>
  </div>
  <div class=\"footer\">
    <p>Gerado pelo prontuário SkinClinic. Este relatório usa apenas dados já registrados na ficha de anamnese e evolução (fotos, textos e resumo do resultado).</p>
  </div>
  <script>
    window.onload = function(){ window.print(); };
  </script>
</body>
</html>`);
          win.document.close();
        });
      }
    }

    registrosEl.querySelectorAll(".anamnese-compare-checkbox").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.id;
        if (!id) return;
        if (cb.checked) {
          if (!selectedIds.includes(id)) selectedIds.push(id);
          if (selectedIds.length > 2) {
            const firstId = selectedIds.shift();
            const firstCb = registrosEl.querySelector(`.anamnese-compare-checkbox[data-id=\"${firstId}\"]`);
            if (firstCb) firstCb.checked = false;
          }
        } else {
          selectedIds = selectedIds.filter((x) => x !== id);
        }
        renderCompare();
      });
    });
  }

  function renderCompareColumn(label, r) {
    const data = r.created_at ? new Date(r.created_at).toLocaleString("pt-BR") : "";
    let body = "";
    if (r.ficha && Object.keys(r.ficha).length > 0) {
      body += "<div class=\"anamnese-registro-ficha\">" + Object.entries(r.ficha).map(([k, v]) => fichaEntryToHtml(k, v)).join("") + "</div>";
    }
    if (r.conteudo && r.conteudo.trim())
      body += "<div class=\"anamnese-registro-conteudo\">" + escapeHtml(r.conteudo) + "</div>";
    if (r.conduta_tratamento && r.conduta_tratamento.trim())
      body +=
        "<div class=\"anamnese-registro-conduta\"><strong>Conduta:</strong> " +
        escapeHtml(r.conduta_tratamento) +
        "</div>";
    if (r.fotos && r.fotos.length > 0) {
      body +=
        "<div class=\"anamnese-registro-fotos anamnese-registro-fotos--compare\">" +
        r.fotos
          .slice(0, 4)
          .map((url) => `<img src="${escapeHtml(url)}" alt="" class="anamnese-foto-thumb">`)
          .join("") +
        "</div>";
    }
    if (!body) body = "<span class=\"anamnese-empty-line\">—</span>";
    return `
      <div class="anamnese-compare-col">
        <h5 class="anamnese-compare-col-title">${escapeHtml(label)}</h5>
        <p class="anamnese-compare-col-date">${escapeHtml(data)}</p>
        ${body}
      </div>
    `;
  }

  if (currentClientId) await loadRegistros();

  btnSalvar.addEventListener("click", async () => {
    if (!currentClientId) {
      toast("Selecione um cliente.");
      return;
    }
    const funcaoId = funcaoSelect.value;
    const slug = getSlugSelected();
    const modoEvolucao = isModoEvolucao();
    const ficha = modoEvolucao ? {} : getFichaFromForm(slug);
    const conteudo = (conteudoEl?.value || "").trim();
    const conduta = (condutaEl?.value || "").trim();
    const files = fotosInput?.files ? Array.from(fotosInput.files) : [];

    if (!funcaoId) {
      toast("Selecione a área/queixa.");
      return;
    }
    if (modoEvolucao) {
      if (!conteudo && !conduta && files.length === 0) {
        toast("Em evolução: preencha observação, conduta ou envie fotos.");
        return;
      }
    } else {
      if (Object.keys(ficha).length === 0 && !conteudo && !conduta && files.length === 0) {
        toast("Preencha ao menos a ficha, observações, conduta ou fotos.");
        return;
      }
    }

    let fotosUrls = [];
    for (const file of files) {
      try {
        const url = await uploadFotoAnamnese(file, currentClientId);
        fotosUrls.push(url);
      } catch (e) {
        console.warn("[ANAMNESE] upload foto", e);
        toast("Uma ou mais fotos não puderam ser enviadas. Salve o resto.");
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      await createRegistro({
        clientId: currentClientId,
        funcaoId,
        conteudo: conteudo || "",
        ficha,
        fotos: fotosUrls,
        conduta_tratamento: conduta || null,
        agendaId: agendaId || null,
        authorId: user?.id || null
      });
      conteudoEl.value = "";
      condutaEl.value = "";
      fotosInput.value = "";
      fotosPreviewEl.innerHTML = "";
      setFichaInForm(slug, {}); // opcional: limpar ficha após salvar
      toast("Ficha salva. Histórico evolutivo atualizado.");
      await loadRegistros();
    } catch (e) {
      console.error("[ANAMNESE] createRegistro", e);
      toast(e.message || "Erro ao salvar.");
    }
  });
}

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

async function loadClientName(clientId, el) {
  if (!el) return;
  try {
    const { data } = await supabase.from("clients").select("name").eq("id", clientId).single();
    if (data?.name) {
      el.textContent = data.name;
      return;
    }
  } catch (_) {}
  try {
    const { data } = await supabase.from("clientes").select("nome").eq("id", clientId).single();
    if (data?.nome) el.textContent = data.nome;
    else el.textContent = "—";
  } catch (_) {
    el.textContent = "—";
  }
}
