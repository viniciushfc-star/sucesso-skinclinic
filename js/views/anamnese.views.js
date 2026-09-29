/**
 * Ficha de Anamnese — por área/queixa (Capilar, Rosto Pele/Injetáveis, Corporal).
 * Ficha vinculada à dor do cliente; fotos e conduta do tratamento.
 * @see .cursor/rules/anamnese-canon.mdc
 */

import { supabase } from "../core/supabase.js";
import { navigate } from "../core/spa.js";
import { toast } from "../ui/toast.js";
import { getClientes, getClientById } from "../services/clientes.service.js";
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
import { ehDuplicataDaUltima, mapaVersaoAnamnese, rotuloVersaoAnamnese } from "../utils/anamnese-versao.js";
import { getRole } from "../services/permissions.service.js";
import { startCameraCapture } from "../utils/camera.js";
import { fileFromClipboardEvent, downloadImageUrl } from "../utils/cliente-cadastro.js";
import { openModal, closeModal } from "../ui/modal.js";
import { MAPAS_EDIT, PRODUTOS_APLICACAO } from "../utils/injetaveis-mapas.js";

const STORAGE_AGENDA = "anamnese_agenda_id";
const STORAGE_CLIENT = "anamnese_client_id";
const STORAGE_PROCEDIMENTO = "anamnese_procedimento";

/** Tipos de campo: section (título), text, textarea, select, sim_nao, sim_nao_complement */
function renderFichaField(c, escapeHtml) {
  const id = "ficha_" + c.key;
  const wrap = (inner, extra = "") => `<div class="anamnese-field ${extra}">${inner}</div>`;
  if (c.type === "section") {
    return `<h4 class="anamnese-ficha-section">${escapeHtml(c.label)}</h4>`;
  }
  if (c.type === "select") {
    const opts = (c.options || []).map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join("");
    return wrap(`<label for="${id}">${escapeHtml(c.label)}</label><select id="${id}" data-ficha-key="${c.key}"><option value="">—</option>${opts}</select>`);
  }
  if (c.type === "sim_nao") {
    return wrap(`<label for="${id}">${escapeHtml(c.label)}</label><select id="${id}" data-ficha-key="${c.key}"><option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option></select>`);
  }
  if (c.type === "sim_nao_complement") {
    const complementId = id + "_complement";
    const complementPlaceholder = c.complementPlaceholder || "Qual? / Por quê? / Há quanto tempo?";
    return wrap(`<label for="${id}">${escapeHtml(c.label)}</label><select id="${id}" data-ficha-key="${c.key}"><option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option></select><input type="text" id="${complementId}" data-ficha-key="${c.key}_complement" placeholder="${escapeHtml(complementPlaceholder)}" class="anamnese-ficha-complement">`, "anamnese-field--wide");
  }
  if (c.type === "textarea") {
    return wrap(`<label for="${id}">${escapeHtml(c.label)}</label><textarea id="${id}" data-ficha-key="${c.key}" placeholder="${escapeHtml(c.placeholder || "")}" rows="3"></textarea>`, "anamnese-field--wide");
  }
  if (c.type === "number") {
    return wrap(`<label for="${id}">${escapeHtml(c.label)}</label><input type="number" id="${id}" data-ficha-key="${c.key}" placeholder="${escapeHtml(c.placeholder || "")}" step="any">`);
  }
  return wrap(`<label for="${id}">${escapeHtml(c.label)}</label><input type="text" id="${id}" data-ficha-key="${c.key}" placeholder="${escapeHtml(c.placeholder || "")}">`);
}

/** Zonas do mapa facial (rótulos no histórico de registros antigos) */
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
  const fotosInputAntes = document.getElementById("anamneseFotosAntes");
  const fotosInputDepois = document.getElementById("anamneseFotosDepois");
  const fotosPreviewAntes = document.getElementById("anamneseFotosPreviewAntes");
  const fotosPreviewDepois = document.getElementById("anamneseFotosPreviewDepois");
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
  let lastRegistrosList = [];
  const fotoPick = { antes: new Set(), depois: new Set() };

  function setAnamneseTab(name) {
    document.querySelectorAll(".anamnese-tab").forEach((btn) => {
      const on = btn.dataset.anamneseTab === name;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll("[data-anamnese-pane]").forEach((pane) => {
      const match = pane.dataset.anamnesePane === name;
      if (pane.id === "anamneseFormWrap" && !currentClientId) {
        pane.classList.add("hidden");
        return;
      }
      pane.classList.toggle("hidden", !match);
    });
    if (name === "historico") loadRegistros();
    if (name === "comparativo") {
      loadRegistros().then(() => renderFotoPicker());
    }
  }

  document.querySelectorAll(".anamnese-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      setAnamneseTab(btn.dataset.anamneseTab);
    });
  });

  function renderWithClient(id) {
    currentClientId = id || "";
    sessionStorage.setItem(STORAGE_CLIENT, currentClientId || "");
    if (clienteSelect) clienteSelect.value = currentClientId || "";

    if (!currentClientId) {
      semClienteEl?.classList.remove("hidden");
      semClienteEl.innerHTML = "<p>Selecione um cliente no campo acima para acessar a ficha.</p>";
      formWrap.classList.add("hidden");
      if (contextEl) contextEl.classList.add("hidden");
      registrosEl.innerHTML = "";
      document.getElementById("btnAnamneseHistorico")?.setAttribute("disabled", "disabled");
      document.getElementById("btnAnamneseComparativo")?.setAttribute("disabled", "disabled");
      setAnamneseTab("ficha");
      return;
    }

    document.getElementById("btnAnamneseHistorico")?.removeAttribute("disabled");
    document.getElementById("btnAnamneseComparativo")?.removeAttribute("disabled");

    semClienteEl?.classList.add("hidden");
    if (document.querySelector(".anamnese-tab.is-active")?.dataset.anamneseTab === "ficha" || !document.querySelector(".anamnese-tab.is-active")) {
      formWrap.classList.remove("hidden");
    }
    contextEl?.classList.remove("hidden");
    contextEl.innerHTML = `
    <p><strong>Cliente:</strong> <span id="anamneseClientName">—</span></p>
    <p id="anamneseClientCep" class="anamnese-cadastro-cep"></p>
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
    semClienteEl.innerHTML = "<p>Selecione um cliente no campo acima para acessar a ficha.</p>";
    formWrap.classList.add("hidden");
    if (contextEl) contextEl.classList.add("hidden");
    registrosEl.innerHTML = "";
    document.getElementById("btnAnamneseHistorico")?.setAttribute("disabled", "disabled");
    document.getElementById("btnAnamneseComparativo")?.setAttribute("disabled", "disabled");
  } else {
    document.getElementById("btnAnamneseHistorico")?.removeAttribute("disabled");
    document.getElementById("btnAnamneseComparativo")?.removeAttribute("disabled");
    semClienteEl?.classList.add("hidden");
    formWrap.classList.remove("hidden");
    if (contextEl) contextEl.classList.remove("hidden");
    contextEl.innerHTML = `
    <p><strong>Cliente:</strong> <span id="anamneseClientName">—</span></p>
    <p id="anamneseClientCep" class="anamnese-cadastro-cep"></p>
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
      if (funcaoId) customCampos = (await listCamposPersonalizados(funcaoId)).filter((c) => String(c.key || "").toLowerCase() !== "cep");
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
      const mapas = MAPAS_EDIT;
      faceWrap.innerHTML = `
        <p class="anamnese-face-map-title">Áreas de aplicação: clique no desenho (rosto, corpo ou glúteo). Tracejado = planejado; preenchido = já aplicado.</p>
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
              <label for="anamnese-ponto-status-${escapeHtml(m.id)}">Nesta sessão</label>
              <select id="anamnese-ponto-status-${escapeHtml(m.id)}" class="anamnese-ponto-status">
                <option value="planejado">Planejado</option>
                <option value="aplicado">Já aplicado</option>
              </select>
              <button type="button" class="btn-small anamnese-ponto-remover">Remover ponto</button>
            </div>
          </div>
        </div>
        `).join("")}
      `;
      fichaCamposEl.appendChild(faceWrap);

      let pontos = []; // { id, mapa, x_pct, y_pct, produto, quantidade, unidade, observacao, status }
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
          const isPlan = pt.status === "planejado";
          dot.className = "anamnese-mapa-dot" + (isPlan ? " anamnese-mapa-dot--planejado" : "") + (selectedPontoId === pt.id ? " selected" : "");
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
          const fase = pt.status === "planejado" ? "plano" : "feito";
          return `<button type="button" class="anamnese-mapa-lista-item ${selectedPontoId === pt.id ? "selected" : ""}" data-ponto-id="${pt.id}">${escapeHtml(label)} · ${escapeHtml(String(qty))} · ${fase}</button>`;
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
        const statusSelect = panel.querySelector(".anamnese-ponto-status");
        const btnRemover = panel.querySelector(".anamnese-ponto-remover");
        if (!detEl) return;
        detEl.classList.remove("hidden");
        if (prodSelect) prodSelect.value = pt.produto || "";
        if (qtyInput) qtyInput.value = pt.quantidade != null ? pt.quantidade : "";
        const prod = PRODUTOS_APLICACAO.find((p) => p.id === pt.produto);
        if (unidadeSpan) unidadeSpan.textContent = "(" + (prod?.unidade || pt.unidade || "un") + ")";
        if (obsInput) obsInput.value = pt.observacao || "";
        if (statusSelect) statusSelect.value = pt.status === "planejado" ? "planejado" : "aplicado";
        function syncPonto() {
          const p = pontos.find((x) => x.id === pt.id);
          if (!p) return;
          p.produto = prodSelect?.value || null;
          p.quantidade = qtyInput?.value !== "" ? (Number(qtyInput.value) || null) : null;
          const pr = PRODUTOS_APLICACAO.find((x) => x.id === p.produto);
          p.unidade = pr?.unidade || null;
          p.observacao = obsInput?.value?.trim() || null;
          p.status = statusSelect?.value === "planejado" ? "planejado" : "aplicado";
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
        statusSelect?.addEventListener("change", syncPonto);
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
          const pt = { id: "p" + nextId++, mapa, x_pct, y_pct, produto: null, quantidade: null, unidade: null, observacao: null, status: "planejado" };
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
            observacao: p.observacao && String(p.observacao).trim() || null,
            status: p.status === "planejado" ? "planejado" : "aplicado"
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
    fotoPick.antes.clear();
    fotoPick.depois.clear();
    await loadRegistros();
    if (document.querySelector(".anamnese-tab.is-active")?.dataset.anamneseTab === "comparativo") {
      renderFotoPicker();
    }
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
    function fill(host, momento) {
      if (!host) return;
      host.innerHTML = "";
      pendingFotos.filter((p) => p.momento === momento).forEach((item) => {
        const src = item.file ? URL.createObjectURL(item.file) : "";
        const card = document.createElement("div");
        card.className = "anamnese-foto-pendente";
        card.innerHTML = `
          <img src="${src}" alt="" class="anamnese-foto-thumb">
          <div class="anamnese-foto-meta">
            <label class="anamnese-foto-meta-label">Data</label>
            <input type="date" class="anamnese-foto-data" value="${escapeHtml(item.data || todayISO())}">
            <label class="anamnese-foto-meta-label">Observação</label>
            <input type="text" class="anamnese-foto-obs" value="${escapeHtml(item.observacao || "")}" placeholder="Ex.: lado direito">
            <button type="button" class="anamnese-foto-remove">Remover</button>
          </div>
        `;
        card.querySelector(".anamnese-foto-data").addEventListener("change", (e) => { item.data = e.target.value || todayISO(); });
        card.querySelector(".anamnese-foto-obs").addEventListener("input", (e) => { item.observacao = e.target.value.trim(); });
        card.querySelector(".anamnese-foto-remove").addEventListener("click", () => {
          pendingFotos = pendingFotos.filter((p) => p.id !== item.id);
          if (src) URL.revokeObjectURL(src);
          renderFotosPreview();
        });
        host.appendChild(card);
      });
    }
    fill(fotosPreviewAntes, "antes");
    fill(fotosPreviewDepois, "depois");
  }

  function addPendingFiles(fileList, momento) {
    const today = todayISO();
    const files = fileList || [];
    for (let i = 0; i < files.length; i++) {
      pendingFotos.push({ id: Date.now() + i, file: files[i], data: today, observacao: "", momento });
    }
    renderFotosPreview();
  }

  fotosInputAntes?.addEventListener("change", () => {
    addPendingFiles(fotosInputAntes.files, "antes");
    fotosInputAntes.value = "";
  });
  fotosInputDepois?.addEventListener("change", () => {
    addPendingFiles(fotosInputDepois.files, "depois");
    fotosInputDepois.value = "";
  });

  document.querySelectorAll(".anamnese-fotos-col").forEach((col) => {
    col.addEventListener("paste", (e) => {
      const file = fileFromClipboardEvent(e);
      if (!file) return;
      e.preventDefault();
      pendingFotos.push({ id: Date.now(), file, data: todayISO(), observacao: "", momento: col.dataset.momento });
      renderFotosPreview();
      toast(col.dataset.momento === "depois" ? "Foto colada em Depois." : "Foto colada em Antes.");
    });
  });

  function abrirCamera(momento) {
    const cameraRef = { stop: () => {} };
    openModal(
      momento === "depois" ? "Foto depois do procedimento" : "Foto antes do procedimento",
      `<div id="anamneseCameraPreview" class="anamnese-camera-preview"></div>
       <p class="anamnese-camera-hint">Posicione e clique em Capturar.</p>`,
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
        pendingFotos.push({ id: Date.now(), file, data: todayISO(), observacao: "", momento });
        cameraRef.stop();
        closeModal();
        renderFotosPreview();
        toast("Foto adicionada. Salve a ficha para gravar.");
      }, toast);
    }
  }
  document.querySelectorAll(".btn-anamnese-camera").forEach((btn) => {
    btn.addEventListener("click", () => abrirCamera(btn.dataset.momento || "antes"));
  });

  async function loadRegistros() {
    const funcaoId = funcaoSelect.value;
    if (!funcaoId || !currentClientId) return;
    try {
      const list = await listRegistrosByClientAndFuncao(currentClientId, funcaoId);
      lastRegistrosList = list;
      registrosEl.innerHTML = list.length === 0
        ? "<p class=\"anamnese-empty\">Nenhum registro ainda para esta área.</p>"
        : list.map((r) => renderRegistroItem(r, list)).join("");
      registrosEl.querySelectorAll(".anamnese-foto-download").forEach((btn) => {
        btn.addEventListener("click", () => {
          downloadImageUrl(btn.getAttribute("data-url"), btn.getAttribute("data-name") || "foto.jpg");
        });
      });
    } catch (e) {
      console.error("[ANAMNESE] listRegistros", e);
      registrosEl.innerHTML = "<p class=\"anamnese-empty\">Erro ao carregar histórico.</p>";
    }
  }

  function collectFotosFromRegistros(list) {
    const out = [];
    (list || []).forEach((r) => {
      (r.fotos || []).forEach((f, i) => {
        const obj = typeof f === "string" ? { url: f } : f;
        if (!obj?.url) return;
        out.push({
          key: `${r.id}:${i}:${obj.url}`,
          url: obj.url,
          momento: fotoMomento(obj) || "",
          data: obj.data || r.created_at,
          registroId: r.id,
        });
      });
    });
    return out;
  }

  function renderFotoPicker() {
    const host = document.getElementById("anamneseFotoPicker");
    const compareWrap = document.getElementById("anamneseCompareWrap");
    if (!host) return;
    const fotos = collectFotosFromRegistros(lastRegistrosList);
    if (!fotos.length) {
      host.innerHTML = "<p class=\"anamnese-empty\">Ainda não há fotos nesta área. Grave na aba Ficha, em Antes e Depois.</p>";
      compareWrap?.classList.add("hidden");
      return;
    }
    host.innerHTML = `
      <div class="anamnese-foto-picker-grid">
        ${fotos.map((f) => {
          const lado = fotoPick.antes.has(f.key) ? "antes" : fotoPick.depois.has(f.key) ? "depois" : "";
          const d = f.data ? new Date(String(f.data).slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR") : "";
          return `<label class="anamnese-foto-pick ${lado ? "is-" + lado : ""}">
            <img src="${escapeHtml(f.url)}" alt="">
            <span>${escapeHtml(d)} ${f.momento ? "· " + f.momento : ""}</span>
            <select data-key="${escapeHtml(f.key)}" data-url="${escapeHtml(f.url)}">
              <option value="" ${!lado ? "selected" : ""}>Não usar</option>
              <option value="antes" ${lado === "antes" ? "selected" : ""}>Usar no Antes</option>
              <option value="depois" ${lado === "depois" ? "selected" : ""}>Usar no Depois</option>
            </select>
          </label>`;
        }).join("")}
      </div>
      <button type="button" class="btn-primary" id="btnAnamneseMontarComparativo">Montar comparativo</button>
    `;
    host.querySelectorAll("select").forEach((sel) => {
      sel.addEventListener("change", () => {
        const key = sel.dataset.key;
        fotoPick.antes.delete(key);
        fotoPick.depois.delete(key);
        if (sel.value === "antes") fotoPick.antes.add(key);
        if (sel.value === "depois") fotoPick.depois.add(key);
        sel.closest(".anamnese-foto-pick")?.classList.toggle("is-antes", sel.value === "antes");
        sel.closest(".anamnese-foto-pick")?.classList.toggle("is-depois", sel.value === "depois");
      });
    });
    host.querySelector("#btnAnamneseMontarComparativo")?.addEventListener("click", () => {
      const urlsAntes = fotos.filter((f) => fotoPick.antes.has(f.key)).map((f) => f.url);
      const urlsDepois = fotos.filter((f) => fotoPick.depois.has(f.key)).map((f) => f.url);
      if (!urlsAntes.length || !urlsDepois.length) {
        toast("Escolha pelo menos uma foto para Antes e uma para Depois.");
        return;
      }
      if (!compareWrap) return;
      compareWrap.classList.remove("hidden");
      compareWrap.innerHTML = `
        <h4 class="anamnese-compare-title">Comparativo sinalizado</h4>
        <div class="anamnese-compare-grid">
          <div class="anamnese-compare-col"><h5>Antes</h5><div class="anamnese-compare-fotos">${urlsAntes.map((u) => `<img src="${escapeHtml(u)}" alt="Antes">`).join("")}</div></div>
          <div class="anamnese-compare-col"><h5>Depois</h5><div class="anamnese-compare-fotos">${urlsDepois.map((u) => `<img src="${escapeHtml(u)}" alt="Depois">`).join("")}</div></div>
        </div>
      `;
    });
  }

  function fichaEntryToHtml(k, v) {
    if (k === "pontos_aplicacao" && Array.isArray(v) && v.length > 0) {
      const byMapa = {};
      v.forEach((p) => {
        const m = p.mapa || "outro";
        if (!byMapa[m]) byMapa[m] = [];
        byMapa[m].push(p);
      });
      const mapaLabel = { rosto: "Rosto", barriga: "Corpo", gluteos: "Glúteos" };
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

  function fotoMomento(f) {
    if (f?.momento === "antes" || f?.momento === "depois") return f.momento;
    const t = String(f?.observacao || "").toLowerCase();
    if (/\bdepois\b/.test(t)) return "depois";
    if (/\bantes\b/.test(t)) return "antes";
    return "";
  }

  function renderRegistroItem(r, list) {
    const data = r.created_at ? new Date(r.created_at).toLocaleString("pt-BR") : "";
    const versao = rotuloVersaoAnamnese(mapaVersaoAnamnese(list || [])[r.id]);
    let body = "";
    if (r.ficha && Object.keys(r.ficha).length > 0) {
      body += "<div class=\"anamnese-registro-ficha\">" + Object.entries(r.ficha).map(([k, v]) => fichaEntryToHtml(k, v)).join("") + "</div>";
    }
    if (r.conteudo && r.conteudo.trim()) body += "<div class=\"anamnese-registro-conteudo\">" + escapeHtml(r.conteudo) + "</div>";
    if (r.conduta_tratamento && r.conduta_tratamento.trim()) body += "<div class=\"anamnese-registro-conduta\"><strong>Conduta:</strong> " + escapeHtml(r.conduta_tratamento) + "</div>";
    if (r.resultado_resumo && r.resultado_resumo.trim()) body += "<div class=\"anamnese-registro-resultado\"><strong>Resumo do resultado:</strong> " + escapeHtml(r.resultado_resumo) + "</div>";
    if (r.fotos && r.fotos.length > 0) {
      const fotosNorm = r.fotos.map((f) => typeof f === "string" ? { url: f, data: null, observacao: null } : f);
      body += "<div class=\"anamnese-registro-fotos\">" + fotosNorm.map((f, i) => {
        const dataStr = f.data ? new Date(f.data + "T12:00:00").toLocaleDateString("pt-BR") : "";
        const obsStr = f.observacao ? escapeHtml(f.observacao) : "";
        const momento = fotoMomento(f);
        const badge = momento ? `<span class="anamnese-foto-badge anamnese-foto-badge--${momento}">${momento === "depois" ? "Depois" : "Antes"}</span>` : "";
        const fname = `anamnese-${momento || "foto"}-${(r.id || "x").slice(0, 8)}-${i + 1}.jpg`;
        return `<div class="anamnese-registro-foto-item">
          <img src="${escapeHtml(f.url)}" alt="" class="anamnese-foto-thumb">
          ${badge}
          ${dataStr || obsStr ? `<div class="anamnese-registro-foto-meta">${dataStr ? `<span class="anamnese-registro-foto-data">${escapeHtml(dataStr)}</span>` : ""}${obsStr ? `<span class="anamnese-registro-foto-obs">${obsStr}</span>` : ""}</div>` : ""}
          <button type="button" class="anamnese-foto-download" data-url="${escapeHtml(f.url)}" data-name="${escapeHtml(fname)}">Baixar</button>
        </div>`;
      }).join("") + "</div>";
    }
    if (!body) body = "<span class=\"anamnese-empty-line\">—</span>";
    const origemBadge = r.origem === "portal"
      ? `<span class="anamnese-origem-portal">Preenchida pelo cliente (à distância)</span>`
      : "";
    return `<article class="anamnese-registro" data-id="${escapeHtml(r.id)}"><div class="anamnese-registro-header"><span class="anamnese-registro-data">${escapeHtml(data)}</span>${versao ? `<span class="anamnese-versao">${escapeHtml(versao)}</span>` : ""}${origemBadge}</div>${body}</article>`;
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
            return { url, data: item.data || todayISO(), observacao: item.observacao || null, momento: item.momento || null };
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
      const atuais = await listRegistrosByClientAndFuncao(currentClientId, funcaoId).catch(() => []);
      if (ehDuplicataDaUltima({
        ficha: fichaLimpa,
        conteudo,
        conduta,
        fotosCount: fotosPayload.length,
        ultima: atuais[0],
      })) {
        toast("Igual à última versão. Nada foi apagado; o prontuário já tem esse documento.");
        return;
      }
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
      toast("Versão " + (atuais.length + 1) + " salva no prontuário (" + dataStr + "). As anteriores continuam lá.");
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
    const client = await getClientById(clientId);
    el.textContent = client?.name || "—";
    const cepEl = document.getElementById("anamneseClientCep");
    if (cepEl) {
      const linha = [client?.cep, client?.endereco, client?.cidade, client?.estado].filter(Boolean).join(" · ");
      cepEl.innerHTML = linha
        ? `<strong>Cadastro:</strong> ${escapeHtml(linha)} · <button type="button" class="btn-link" id="anamneseAbrirCadastro">editar no cadastro</button>`
        : `CEP e endereço ficam no <button type="button" class="btn-link" id="anamneseAbrirCadastro">cadastro da pessoa</button>, não nesta ficha.`;
      document.getElementById("anamneseAbrirCadastro")?.addEventListener("click", () => {
        sessionStorage.setItem("clientePerfilId", clientId);
        navigate("cliente-perfil");
      });
    }
  } catch (_) {
    el.textContent = "—";
  }
}
