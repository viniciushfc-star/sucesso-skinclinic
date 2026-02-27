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
  updateResultadoResumo,
  listCamposPersonalizados,
  createCampoPersonalizado,
  deleteCampoPersonalizado
} from "../services/anamnesis.service.js";
import { getRole } from "../services/permissions.service.js";
import { startCameraCapture } from "../utils/camera.js";
import { openModal, closeModal } from "../ui/modal.js";

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
  if (c.type === "number") {
    return `<label for="${id}">${escapeHtml(c.label)}</label><input type="number" id="${id}" data-ficha-key="${c.key}" placeholder="${escapeHtml(c.placeholder || "")}" step="any">`;
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

/** Produtos aplicáveis e unidade de medida (por ponto) */
const PRODUTOS_APLICACAO = [
  { id: "botox", label: "Toxina botulínica (Botox)", unidade: "UI" },
  { id: "bioestimulador", label: "Bioestimulador", unidade: "UI" },
  { id: "preenchimento", label: "Preenchimento (AH)", unidade: "ml" },
  { id: "outro", label: "Outro", unidade: "un" }
];

/** SVG rosto (vista frontal) — clique na imagem para marcar pontos */
const FACE_SVG = `
<svg viewBox="0 0 200 260" class="anamnese-mapa-svg" aria-label="Rosto: clique para marcar ponto de aplicação">
  <ellipse cx="100" cy="100" rx="75" ry="95" fill="#fefce8" stroke="#cbd5e1" stroke-width="1.5"/>
  <ellipse cx="70" cy="85" rx="12" ry="14" fill="none" stroke="#94a3b8" stroke-width="1"/>
  <ellipse cx="130" cy="85" rx="12" ry="14" fill="none" stroke="#94a3b8" stroke-width="1"/>
  <path d="M 65 130 Q 100 150 135 130" fill="none" stroke="#94a3b8" stroke-width="1"/>
  <ellipse cx="100" cy="165" rx="15" ry="18" fill="none" stroke="#94a3b8" stroke-width="1"/>
  <text x="100" y="235" text-anchor="middle" font-size="9" fill="#64748b">Clique no rosto para adicionar ponto</text>
</svg>
`;

/** SVG barriga (contorno simplificado) */
const BARRIGA_SVG = `
<svg viewBox="0 0 180 220" class="anamnese-mapa-svg" aria-label="Barriga: clique para marcar ponto">
  <ellipse cx="90" cy="70" rx="55" ry="25" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>
  <path d="M 35 70 Q 90 180 145 70" fill="#fefce8" stroke="#cbd5e1" stroke-width="1.5"/>
  <text x="90" y="200" text-anchor="middle" font-size="9" fill="#64748b">Clique para adicionar ponto</text>
</svg>
`;

/** SVG glúteos (dois contornos) */
const GLUTEOS_SVG = `
<svg viewBox="0 0 200 180" class="anamnese-mapa-svg" aria-label="Glúteos: clique para marcar ponto">
  <ellipse cx="65" cy="75" rx="45" ry="55" fill="#fefce8" stroke="#cbd5e1" stroke-width="1.5"/>
  <ellipse cx="135" cy="75" rx="45" ry="55" fill="#fefce8" stroke="#cbd5e1" stroke-width="1.5"/>
  <text x="100" y="165" text-anchor="middle" font-size="9" fill="#64748b">Clique para adicionar ponto</text>
</svg>
`;

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
    if (contextEl) contextEl.classList.remove("hidden");
    contextEl.innerHTML = `
    <p><strong>Cliente:</strong> <span id="anamneseClientName">—</span></p>
    ${agendaId || sessionStorage.getItem(STORAGE_CLIENT) ? "<p class=\"anamnese-context-hint\">Cliente já selecionado. Escolha a <strong>área</strong> (Capilar, Pele, Injetáveis, Corporal) e preencha a ficha.</p>" : ""}
    ${procedimento ? `<p><strong>Atendimento:</strong> ${escapeHtml(procedimento)}</p>` : ""}
    ${agendaId ? "<p class=\"anamnese-context-from-agenda\">Contexto deste atendimento (agenda).</p>" : ""}
  `;
    loadClientName(currentClientId, document.getElementById("anamneseClientName"));
    loadRegistros();
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

  /** Campos personalizados da clínica (por função); usado em getFichaFromForm/setFichaInForm. */
  let currentCustomCampos = [];

  function getSlugSelected() {
    const opt = funcaoSelect.options[funcaoSelect.selectedIndex];
    return opt?.dataset?.slug || "";
  }

  async function renderFichaCampos(slug) {
    const funcaoId = funcaoSelect.value || "";
    let customCampos = [];
    try {
      if (funcaoId) customCampos = await listCamposPersonalizados(funcaoId);
    } catch (e) {
      console.warn("[ANAMNESE] listCamposPersonalizados", e);
    }
    currentCustomCampos = customCampos.map((c) => ({ key: c.key, label: c.label, type: c.type, placeholder: c.placeholder, options: c.options || [] }));

    const campos = FICHA_CAMPOS[slug] || [];
    const allCampos = [...campos, ...customCampos.map((c) => ({ key: c.key, label: c.label, type: c.type, placeholder: c.placeholder, options: c.options || [], _id: c.id }))];
    fichaCamposEl.innerHTML = allCampos.map((c) => renderFichaField(c, escapeHtml)).join("");

    if (slug === "rosto_injetaveis") {
      const faceWrap = document.createElement("div");
      faceWrap.id = "anamneseFaceMapWrap";
      faceWrap.className = "anamnese-face-map-wrap anamnese-face-map-wrap--large";
      const mapas = [
        { id: "rosto", label: "Rosto", svg: FACE_SVG },
        { id: "barriga", label: "Barriga", svg: BARRIGA_SVG },
        { id: "gluteos", label: "Glúteos", svg: GLUTEOS_SVG }
      ];
      faceWrap.innerHTML = `
        <p class="anamnese-face-map-title">Clique na imagem onde foi aplicado; em cada ponto escolha o produto e a quantidade. A unidade (UI, ml) muda conforme o produto.</p>
        <div class="anamnese-mapa-tabs">
          ${mapas.map((m) => `<button type="button" class="anamnese-mapa-tab" data-mapa="${escapeHtml(m.id)}">${escapeHtml(m.label)}</button>`).join("")}
        </div>
        ${mapas.map((m) => `
        <div class="anamnese-mapa-panel" id="anamneseMapaPanel_${escapeHtml(m.id)}" data-mapa="${escapeHtml(m.id)}">
          <div class="anamnese-mapa-clicavel" data-mapa="${escapeHtml(m.id)}" role="button" tabindex="0" aria-label="Clique para adicionar ponto em ${escapeHtml(m.label)}">
            <div class="anamnese-mapa-svg-wrap">${m.svg}</div>
            <div class="anamnese-mapa-pontos" id="anamneseMapaPontos_${escapeHtml(m.id)}"></div>
          </div>
          <div class="anamnese-mapa-lista">
            <p class="anamnese-mapa-lista-title">Pontos em ${escapeHtml(m.label)}</p>
            <div class="anamnese-mapa-lista-itens" id="anamneseMapaLista_${escapeHtml(m.id)}"></div>
            <div id="anamneseMapaDetalhes_${escapeHtml(m.id)}" class="anamnese-ponto-detalhes hidden">
              <p class="anamnese-ponto-detalhes-title">Detalhes do ponto</p>
              <label for="anamnese-ponto-produto-${escapeHtml(m.id)}">O que foi aplicado?</label>
              <select id="anamnese-ponto-produto-${escapeHtml(m.id)}" class="anamnese-ponto-produto">
                <option value="">— Selecione —</option>
                ${PRODUTOS_APLICACAO.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label)}</option>`).join("")}
              </select>
              <label class="anamnese-ponto-quantidade-label" for="anamnese-ponto-quantidade-${escapeHtml(m.id)}">Quantidade <span class="anamnese-ponto-unidade">(UI)</span></label>
              <input type="number" id="anamnese-ponto-quantidade-${escapeHtml(m.id)}" class="anamnese-ponto-quantidade" min="0" step="0.01" placeholder="0">
              <label for="anamnese-ponto-obs-${escapeHtml(m.id)}">Observação (opcional)</label>
              <input type="text" id="anamnese-ponto-obs-${escapeHtml(m.id)}" class="anamnese-ponto-obs" placeholder="Ex.: técnica, profundidade">
              <button type="button" class="btn-small anamnese-ponto-remover">Remover ponto</button>
            </div>
          </div>
        </div>
        `).join("")}
      `;
      fichaCamposEl.appendChild(faceWrap);

      let pontos = []; // { id, mapa, x_pct, y_pct, produto, quantidade, unidade, observacao }
      let selectedPontoId = null;
      let nextId = 1;

      function getPontosByMapa(mapa) {
        return pontos.filter((p) => p.mapa === mapa);
      }

      function renderPontosOnMap(panel) {
        const mapa = panel.dataset.mapa;
        const container = panel.querySelector(".anamnese-mapa-pontos");
        if (!container) return;
        container.innerHTML = "";
        getPontosByMapa(mapa).forEach((pt) => {
          const dot = document.createElement("div");
          dot.className = "anamnese-mapa-dot" + (selectedPontoId === pt.id ? " selected" : "");
          dot.style.left = pt.x_pct + "%";
          dot.style.top = pt.y_pct + "%";
          dot.dataset.pontoId = pt.id;
          dot.title = (PRODUTOS_APLICACAO.find((p) => p.id === pt.produto)?.label || pt.produto || "Ponto") + (pt.quantidade != null ? " — " + pt.quantidade + " " + (pt.unidade || "") : "");
          dot.addEventListener("click", (e) => {
            e.stopPropagation();
            selectedPontoId = pt.id;
            renderAllPontos();
            showPontoDetalhes(panel, pt);
          });
          container.appendChild(dot);
        });
      }

      function renderLista(panel) {
        const mapa = panel.dataset.mapa;
        const listEl = panel.querySelector(".anamnese-mapa-lista-itens");
        if (!listEl) return;
        const itens = getPontosByMapa(mapa);
        if (itens.length === 0) {
          listEl.innerHTML = "<p class=\"anamnese-mapa-lista-vazio\">Nenhum ponto. Clique na imagem ao lado.</p>";
          return;
        }
        listEl.innerHTML = itens.map((pt) => {
          const prod = PRODUTOS_APLICACAO.find((p) => p.id === pt.produto);
          const label = prod ? prod.label : (pt.produto || "—");
          const qty = pt.quantidade != null ? pt.quantidade + " " + (pt.unidade || "") : "—";
          return `<button type="button" class="anamnese-mapa-lista-item ${selectedPontoId === pt.id ? "selected" : ""}" data-ponto-id="${pt.id}">${escapeHtml(label)} · ${escapeHtml(String(qty))}</button>`;
        }).join("");
        listEl.querySelectorAll(".anamnese-mapa-lista-item").forEach((btn) => {
          btn.addEventListener("click", () => {
            const pt = pontos.find((p) => p.id === btn.dataset.pontoId);
            if (pt) {
              selectedPontoId = pt.id;
              renderAllPontos();
              const panel = faceWrap.querySelector(`#anamneseMapaPanel_${pt.mapa}`);
              if (panel) showPontoDetalhes(panel, pt);
            }
          });
        });
      }

      function showPontoDetalhes(panel, pt) {
        const mapa = panel.dataset.mapa;
        const detEl = panel.querySelector(".anamnese-ponto-detalhes");
        const prodSelect = panel.querySelector(".anamnese-ponto-produto");
        const qtyInput = panel.querySelector(".anamnese-ponto-quantidade");
        const unidadeSpan = panel.querySelector(".anamnese-ponto-unidade");
        const obsInput = panel.querySelector(".anamnese-ponto-obs");
        const btnRemover = panel.querySelector(".anamnese-ponto-remover");
        if (!detEl) return;
        detEl.classList.remove("hidden");
        if (prodSelect) prodSelect.value = pt.produto || "";
        if (qtyInput) qtyInput.value = pt.quantidade != null ? pt.quantidade : "";
        const prod = PRODUTOS_APLICACAO.find((p) => p.id === pt.produto);
        if (unidadeSpan) unidadeSpan.textContent = "(" + (prod?.unidade || pt.unidade || "un") + ")";
        if (obsInput) obsInput.value = pt.observacao || "";
        function syncPonto() {
          const p = pontos.find((x) => x.id === pt.id);
          if (!p) return;
          p.produto = prodSelect?.value || null;
          p.quantidade = qtyInput?.value !== "" ? (Number(qtyInput.value) || null) : null;
          const pr = PRODUTOS_APLICACAO.find((x) => x.id === p.produto);
          p.unidade = pr?.unidade || null;
          p.observacao = obsInput?.value?.trim() || null;
          renderPontosOnMap(panel);
          renderLista(panel);
        }
        prodSelect?.removeEventListener("change", syncPonto);
        qtyInput?.removeEventListener("input", syncPonto);
        obsInput?.removeEventListener("input", syncPonto);
        prodSelect?.addEventListener("change", () => {
          const pr = PRODUTOS_APLICACAO.find((x) => x.id === prodSelect.value);
          if (unidadeSpan) unidadeSpan.textContent = "(" + (pr?.unidade || "un") + ")";
          syncPonto();
        });
        qtyInput?.addEventListener("input", syncPonto);
        obsInput?.addEventListener("input", syncPonto);
        const removeBtn = panel.querySelector(".anamnese-ponto-remover");
        if (removeBtn) {
          removeBtn.onclick = () => {
            pontos = pontos.filter((p) => p.id !== pt.id);
            selectedPontoId = null;
            detEl.classList.add("hidden");
            renderAllPontos();
          };
        }
      }

      function renderAllPontos() {
        faceWrap.querySelectorAll(".anamnese-mapa-panel").forEach((panel) => {
          renderPontosOnMap(panel);
          renderLista(panel);
        });
      }

      faceWrap.querySelectorAll(".anamnese-mapa-clicavel").forEach((el) => {
        el.addEventListener("click", (e) => {
          if (e.target.closest(".anamnese-mapa-dot")) return;
          const rect = el.getBoundingClientRect();
          const x_pct = ((e.clientX - rect.left) / rect.width) * 100;
          const y_pct = ((e.clientY - rect.top) / rect.height) * 100;
          const mapa = el.dataset.mapa;
          const pt = { id: "p" + nextId++, mapa, x_pct, y_pct, produto: null, quantidade: null, unidade: null, observacao: null };
          pontos.push(pt);
          selectedPontoId = pt.id;
          const panel = el.closest(".anamnese-mapa-panel");
          renderAllPontos();
          if (panel) showPontoDetalhes(panel, pt);
        });
      });

      faceWrap.querySelectorAll(".anamnese-mapa-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
          faceWrap.querySelectorAll(".anamnese-mapa-tab").forEach((t) => t.classList.remove("active"));
          tab.classList.add("active");
          faceWrap.querySelectorAll(".anamnese-mapa-panel").forEach((p) => p.classList.add("hidden"));
          const panel = faceWrap.querySelector("#anamneseMapaPanel_" + tab.dataset.mapa);
          if (panel) panel.classList.remove("hidden");
        });
      });
      faceWrap.querySelector(".anamnese-mapa-tab")?.classList.add("active");
      faceWrap.querySelectorAll(".anamnese-mapa-panel").forEach((p, i) => {
        if (i > 0) p.classList.add("hidden");
      });

      faceWrap._getPontos = () => pontos.slice();
      faceWrap._setPontos = (arr) => {
        pontos = Array.isArray(arr) ? arr.map((p) => ({ ...p, id: p.id != null ? p.id : "p" + nextId++ })) : [];
        selectedPontoId = null;
        renderAllPontos();
      };
      renderAllPontos();
    }

    let canManageCampos = false;
    try {
      const role = await getRole();
      canManageCampos = role === "master" || role === "gestor";
    } catch (_) {}
    const clinicaWrap = document.createElement("div");
    clinicaWrap.className = "anamnese-campos-clinica-wrap";
    clinicaWrap.innerHTML = `
      <h4 class="anamnese-ficha-section anamnese-campos-clinica-title">Incluir mais (conforme sua clínica)</h4>
      <p class="anamnese-campos-clinica-hint">Adicione campos extras para esta área. Eles ficam salvos na ficha e adaptam o formulário à sua clínica.</p>
      ${customCampos.length ? `<div class="anamnese-campos-clinica-lista">${customCampos.map((c) => `
        <div class="anamnese-campo-personalizado-row" data-campo-id="${c.id}">
          <span class="anamnese-campo-personalizado-label">${escapeHtml(c.label)}</span>
          ${canManageCampos ? `<button type="button" class="btn-icon anamnese-campo-remover" title="Remover campo" data-id="${c.id}" aria-label="Remover">×</button>` : ""}
        </div>
      `).join("")}</div>` : ""}
      ${canManageCampos ? `<button type="button" class="btn-secondary anamnese-campo-adicionar" id="btnAnamneseAdicionarCampo"><span aria-hidden="true">+</span> Adicionar campo</button>` : ""}
    `;
    fichaCamposEl.appendChild(clinicaWrap);
    if (canManageCampos) {
      clinicaWrap.querySelectorAll(".anamnese-campo-remover").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!confirm("Remover este campo da ficha? Os dados já preenchidos em outros registros não são apagados.")) return;
          try {
            await deleteCampoPersonalizado(btn.dataset.id);
            toast("Campo removido.");
            await renderFichaCampos(slug);
          } catch (e) {
            toast(e.message || "Erro ao remover.");
          }
        });
      });
      const btnAdd = document.getElementById("btnAnamneseAdicionarCampo");
      if (btnAdd) btnAdd.addEventListener("click", () => openModalAdicionarCampo(funcaoId, slug));
    }
  }

  function openModalAdicionarCampo(funcaoId, slug) {
    const modalContent = `
      <div class="anamnese-modal-campo">
        <p class="form-hint">O campo será incluído nesta área e aparecerá para todos os atendimentos. Use uma chave única (ex.: medicacao_rotina).</p>
        <label for="anamneseCampoLabel">Nome do campo (ex.: Medicação de rotina)</label>
        <input type="text" id="anamneseCampoLabel" placeholder="Ex.: Medicação de rotina" required>
        <label for="anamneseCampoKey">Chave (identificador único, sem espaços)</label>
        <input type="text" id="anamneseCampoKey" placeholder="Ex.: medicacao_rotina">
        <label for="anamneseCampoTipo">Tipo</label>
        <select id="anamneseCampoTipo">
          <option value="text">Texto curto</option>
          <option value="textarea">Texto longo</option>
          <option value="sim_nao">Sim/Não</option>
          <option value="number">Número</option>
          <option value="select">Lista (opções abaixo)</option>
        </select>
        <label for="anamneseCampoPlaceholder">Placeholder (opcional)</label>
        <input type="text" id="anamneseCampoPlaceholder" placeholder="Ex.: Descreva aqui">
        <div id="anamneseCampoOptionsWrap" class="hidden">
          <label>Opções (uma por linha, formato: valor|texto)</label>
          <textarea id="anamneseCampoOptions" rows="3" placeholder="sim|Sim\nnao|Não"></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="btnAnamneseCampoCancel">Cancelar</button>
          <button type="button" class="btn-primary" id="btnAnamneseCampoSalvar">Adicionar</button>
        </div>
      </div>
    `;
    openModal("Adicionar campo à ficha", modalContent);
    const labelEl = document.getElementById("anamneseCampoLabel");
    const keyEl = document.getElementById("anamneseCampoKey");
    const tipoEl = document.getElementById("anamneseCampoTipo");
    const placeholderEl = document.getElementById("anamneseCampoPlaceholder");
    const optionsWrap = document.getElementById("anamneseCampoOptionsWrap");
    const optionsEl = document.getElementById("anamneseCampoOptions");
    const slugFromLabel = (s) => (s || "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || "custom_" + Date.now();
    labelEl?.addEventListener("input", () => {
      if (keyEl && !keyEl.value) keyEl.value = slugFromLabel(labelEl.value);
    });
    tipoEl?.addEventListener("change", () => {
      if (optionsWrap) optionsWrap.classList.toggle("hidden", tipoEl.value !== "select");
    });
    document.getElementById("btnAnamneseCampoCancel")?.addEventListener("click", () => closeModal());
    document.getElementById("btnAnamneseCampoSalvar")?.addEventListener("click", async () => {
      const label = labelEl?.value?.trim();
      const key = (keyEl?.value?.trim() || slugFromLabel(label)).replace(/[^a-z0-9_]/gi, "_").toLowerCase() || "custom_" + Date.now();
      const type = tipoEl?.value || "text";
      const placeholder = placeholderEl?.value?.trim() || null;
      let options = [];
      if (type === "select" && optionsEl?.value?.trim()) {
        options = optionsEl.value.trim().split("\n").map((line) => {
          const parts = line.split("|").map((p) => p.trim());
          return { value: parts[0] || "", label: parts[1] || parts[0] || "" };
        }).filter((o) => o.value || o.label);
      }
      if (!label) {
        toast("Informe o nome do campo.");
        return;
      }
      try {
        await createCampoPersonalizado({ funcaoId, key, label, type, placeholder, options });
        closeModal();
        toast("Campo adicionado. Ele já aparece na ficha.");
        await renderFichaCampos(slug);
      } catch (e) {
        toast(e.message || "Erro ao adicionar campo.");
      }
    });
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
    for (const c of currentCustomCampos) {
      const el = document.getElementById("ficha_" + c.key);
      if (el && el.value != null && String(el.value).trim()) ficha[c.key] = String(el.value).trim();
    }
    if (slug === "rosto_injetaveis") {
      const wrap = document.getElementById("anamneseFaceMapWrap");
      const pts = wrap?._getPontos?.() || [];
      if (pts.length) {
        ficha.pontos_aplicacao = pts.map((p) => {
          const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
          return {
            id: p.id != null ? p.id : null,
            mapa: p.mapa && String(p.mapa) || null,
            x_pct: num(p.x_pct),
            y_pct: num(p.y_pct),
            produto: p.produto && String(p.produto) || null,
            quantidade: num(p.quantidade),
            unidade: p.unidade && String(p.unidade) || null,
            observacao: p.observacao && String(p.observacao).trim() || null
          };
        }).filter((p) => p.x_pct != null && p.y_pct != null);
      }
    }
    return ficha;
  }

  /** Garante objeto ficha serializável para o Supabase (sem undefined/NaN). */
  function sanitizeFicha(ficha) {
    if (!ficha || typeof ficha !== "object") return {};
    const out = {};
    for (const [k, v] of Object.entries(ficha)) {
      if (v === undefined) continue;
      if (typeof v === "number" && !Number.isFinite(v)) continue;
      if (Array.isArray(v)) {
        out[k] = v.map((item) => {
          if (item && typeof item === "object") {
            const obj = {};
            for (const [kk, vv] of Object.entries(item)) {
              if (vv === undefined) continue;
              if (typeof vv === "number" && !Number.isFinite(vv)) continue;
              obj[kk] = vv;
            }
            return obj;
          }
          return item;
        });
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  function setFichaInForm(slug, ficha) {
    if (!ficha || typeof ficha !== "object") return;
    for (const key of Object.keys(ficha)) {
      const el = document.getElementById("ficha_" + key);
      if (el) el.value = ficha[key] != null ? String(ficha[key]) : "";
    }
    for (const c of currentCustomCampos) {
      const el = document.getElementById("ficha_" + c.key);
      if (el && ficha[c.key] != null) el.value = String(ficha[c.key]);
    }
    if (slug === "rosto_injetaveis") {
      const pts = ficha.pontos_aplicacao;
      if (Array.isArray(pts) && pts.length > 0) {
        const wrap = document.getElementById("anamneseFaceMapWrap");
        wrap?._setPontos?.(pts);
      }
    }
  }

  function isModoEvolucao() {
    return tipoRegistroSelect && tipoRegistroSelect.value === "evolucao";
  }

  function toggleFichaVisivel() {
    if (fichaCamposWrap) fichaCamposWrap.classList.toggle("hidden", isModoEvolucao());
    if (btnSalvar) btnSalvar.textContent = isModoEvolucao() ? "Registrar evolução" : "Salvar ficha";
  }

  async function onFuncaoChange() {
    await renderFichaCampos(getSlugSelected());
  }

  if (tipoRegistroSelect) tipoRegistroSelect.addEventListener("change", toggleFichaVisivel);
  funcaoSelect.addEventListener("change", onFuncaoChange);
  onFuncaoChange();
  toggleFichaVisivel();

  /** Lista de fotos pendentes: { id, file, data (YYYY-MM-DD), observacao } */
  let pendingFotos = [];

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function renderFotosPreview() {
    fotosPreviewEl.innerHTML = "";
    pendingFotos.forEach((item) => {
      const src = typeof item.file !== "undefined" && item.file ? URL.createObjectURL(item.file) : "";
      const card = document.createElement("div");
      card.className = "anamnese-foto-pendente";
      card.dataset.id = item.id;
      card.innerHTML = `
        <img src="${src}" alt="" class="anamnese-foto-thumb">
        <div class="anamnese-foto-meta">
          <label class="anamnese-foto-meta-label">Data</label>
          <input type="date" class="anamnese-foto-data" value="${escapeHtml(item.data || todayISO())}" aria-label="Data da foto">
          <label class="anamnese-foto-meta-label">Observação</label>
          <input type="text" class="anamnese-foto-obs" value="${escapeHtml(item.observacao || "")}" placeholder="Ex.: antes do procedimento" aria-label="Observação da foto">
          <button type="button" class="anamnese-foto-remove" aria-label="Remover foto">Remover</button>
        </div>
      `;
      const dataInput = card.querySelector(".anamnese-foto-data");
      const obsInput = card.querySelector(".anamnese-foto-obs");
      const btnRemove = card.querySelector(".anamnese-foto-remove");
      dataInput.addEventListener("change", () => { item.data = dataInput.value || todayISO(); });
      obsInput.addEventListener("input", () => { item.observacao = obsInput.value.trim(); });
      btnRemove.addEventListener("click", () => {
        pendingFotos = pendingFotos.filter((p) => p.id !== item.id);
        if (src) URL.revokeObjectURL(src);
        renderFotosPreview();
      });
      fotosPreviewEl.appendChild(card);
    });
  }

  fotosInput.addEventListener("change", () => {
    const files = fotosInput.files;
    if (!files?.length) return;
    const today = todayISO();
    for (let i = 0; i < files.length; i++) {
      pendingFotos.push({ id: Date.now() + i, file: files[i], data: today, observacao: "" });
    }
    fotosInput.value = "";
    renderFotosPreview();
  });

  const btnTirarFoto = document.getElementById("btnAnamneseTirarFoto");
  if (btnTirarFoto) {
    btnTirarFoto.addEventListener("click", () => {
      const cameraRef = { stop: () => {} };
      openModal(
        "Tirar foto",
        `<div id="anamneseCameraPreview" class="anamnese-camera-preview"></div>
         <p class="anamnese-camera-hint">Posicione e clique em Capturar. A foto será adicionada à lista com data de hoje.</p>`,
        () => {},
        () => {
          cameraRef.stop();
          closeModal();
        }
      );
      const previewEl = document.getElementById("anamneseCameraPreview");
      if (previewEl) {
        cameraRef.stop = startCameraCapture(previewEl, (blob) => {
          const file = new File([blob], `captura_${Date.now()}.jpg`, { type: "image/jpeg" });
          pendingFotos.push({ id: Date.now(), file, data: todayISO(), observacao: "" });
          cameraRef.stop();
          closeModal();
          renderFotosPreview();
          toast("Foto adicionada. Ajuste data e observação se quiser e salve a ficha.");
        }, toast);
      }
    });
  }

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
    if (k === "pontos_aplicacao" && Array.isArray(v) && v.length > 0) {
      const byMapa = {};
      v.forEach((p) => {
        const m = p.mapa || "outro";
        if (!byMapa[m]) byMapa[m] = [];
        byMapa[m].push(p);
      });
      const mapaLabel = { rosto: "Rosto", barriga: "Barriga", gluteos: "Glúteos" };
      let html = "<p><strong>Pontos de aplicação:</strong></p><ul class=\"anamnese-registro-pontos\">";
      ["rosto", "barriga", "gluteos"].forEach((mapa) => {
        const list = byMapa[mapa];
        if (!list?.length) return;
        html += "<li><strong>" + escapeHtml(mapaLabel[mapa] || mapa) + ":</strong> ";
        html += list.map((p) => {
          const prod = PRODUTOS_APLICACAO.find((x) => x.id === p.produto);
          const nome = prod ? prod.label : (p.produto || "—");
          const qty = p.quantidade != null ? p.quantidade + " " + (p.unidade || "") : "";
          return nome + (qty ? " · " + qty : "") + (p.observacao ? " (" + p.observacao + ")" : "");
        }).map((s) => escapeHtml(s)).join("; ");
        html += "</li>";
      });
      html += "</ul>";
      return html;
    }
    if (k === "areas_aplicacao_detalhes" && Array.isArray(v) && v.length > 0) {
      let html = "<p><strong>Detalhes por área:</strong></p><ul class=\"anamnese-registro-detalhes-zonas\">";
      v.forEach((d) => {
        const zoneLabel = FACE_ZONAS.find((z) => z.id === d.zone_id)?.label || d.zone_id;
        const parts = [];
        if (d.ui != null) parts.push(d.ui + " UI");
        if (d.produto) parts.push("O quê: " + d.produto);
        if (d.como) parts.push("Como: " + d.como);
        if (d.por_que) parts.push("Por quê: " + d.por_que);
        html += "<li><strong>" + escapeHtml(zoneLabel) + "</strong>: " + escapeHtml(parts.join(" · ")) + "</li>";
      });
      html += "</ul>";
      return html;
    }
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
      const fotosNorm = r.fotos.map((f) => typeof f === "string" ? { url: f, data: null, observacao: null } : f);
      body += "<div class=\"anamnese-registro-fotos\">" + fotosNorm.map((f) => {
        const dataStr = f.data ? new Date(f.data + "T12:00:00").toLocaleDateString("pt-BR") : "";
        const obsStr = f.observacao ? escapeHtml(f.observacao) : "";
        return `<div class="anamnese-registro-foto-item"><img src="${escapeHtml(f.url)}" alt="" class="anamnese-foto-thumb">${dataStr || obsStr ? `<div class="anamnese-registro-foto-meta">${dataStr ? `<span class="anamnese-registro-foto-data">${escapeHtml(dataStr)}</span>` : ""}${obsStr ? `<span class="anamnese-registro-foto-obs">${obsStr}</span>` : ""}</div>` : ""}</div>`;
      }).join("") + "</div>";
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
          const fotosAntes = (before.fotos || []).slice(0, 4).map((f) => (typeof f === "string" ? f : f.url)).filter(Boolean);
          const fotosDepois = (after.fotos || []).slice(0, 4).map((f) => (typeof f === "string" ? f : f.url)).filter(Boolean);

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
      const urls = r.fotos.slice(0, 4).map((f) => (typeof f === "string" ? f : f.url)).filter(Boolean);
      body +=
        "<div class=\"anamnese-registro-fotos anamnese-registro-fotos--compare\">" +
        urls.map((url) => `<img src="${escapeHtml(url)}" alt="" class="anamnese-foto-thumb">`).join("") +
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

    if (!funcaoId) {
      toast("Selecione a área/queixa.");
      return;
    }
    const hasPendingFotos = pendingFotos.length > 0;
    if (modoEvolucao) {
      if (!conteudo && !conduta && !hasPendingFotos) {
        toast("Em evolução: preencha observação, conduta ou envie fotos.");
        return;
      }
    } else {
      if (Object.keys(ficha).length === 0 && !conteudo && !conduta && !hasPendingFotos) {
        toast("Preencha ao menos a ficha, observações, conduta ou fotos.");
        return;
      }
    }

    const fotosPayload = [];
    const BATCH = 5;
    for (let i = 0; i < pendingFotos.length; i += BATCH) {
      const batch = pendingFotos.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (item) => {
          try {
            const url = await uploadFotoAnamnese(item.file, currentClientId, String(item.id));
            return { url, data: item.data || todayISO(), observacao: item.observacao || null };
          } catch (e) {
            console.warn("[ANAMNESE] upload foto", item.id, e);
            return null;
          }
        })
      );
      results.filter(Boolean).forEach((r) => fotosPayload.push(r));
    }
    if (pendingFotos.length > 0 && fotosPayload.length < pendingFotos.length) {
      toast(`${fotosPayload.length} de ${pendingFotos.length} fotos enviadas. Verifique conexão e tente novamente.`, "warn");
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const fichaLimpa = sanitizeFicha(ficha);
      await createRegistro({
        clientId: currentClientId,
        funcaoId,
        conteudo: conteudo || "",
        ficha: fichaLimpa,
        fotos: fotosPayload,
        conduta_tratamento: conduta || null,
        agendaId: agendaId || null,
        authorId: user?.id || null
      });
      conteudoEl.value = "";
      condutaEl.value = "";
      pendingFotos = [];
      renderFotosPreview();
      setFichaInForm(slug, {});
      const dataStr = new Date().toLocaleDateString("pt-BR");
      toast("Documento salvo no prontuário do paciente (" + dataStr + "). Ele ficará disponível ao abrir o cliente.");
      await loadRegistros();
    } catch (e) {
      console.error("[ANAMNESE] createRegistro", e);
      const msg = e?.message || e?.error_description || "Erro ao salvar.";
      toast(msg.length > 80 ? msg.slice(0, 80) + "…" : msg, "error");
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
