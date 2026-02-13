/**
 * Análise de Pele por IA (MVP) — fluxo no portal do cliente.
 * Etapas: consentimento → fotos → perguntas → envio → "recebido" (sem texto da IA).
 * Devolutiva ao cliente só após validação da clínica (evita ansiedade e autoatuação).
 */

import { submitAnalisePele, getAnalisesPeleByToken } from "./client-portal.service.js";
import { toast } from "./ui/toast.client.js";

const app = document.getElementById("app");
let step = 0;
let state = {
  consentimento: false,
  menor_responsavel: "",
  imagens: [],
  respostas: {},
};

const PERGUNTAS = [
  { id: "queixa_principal", label: "Qual é a principal queixa em relação à sua pele?", placeholder: "Ex.: manchas, acne, ressecamento" },
  { id: "quando_comecou", label: "Quando começou ou quando percebeu?", placeholder: "Ex.: há alguns meses, após o verão" },
  { id: "o_que_incomoda", label: "O que mais incomoda no dia a dia?", placeholder: "Ex.: aparência, coceira, sensibilidade" },
  { id: "o_que_ja_tentou", label: "O que você já tentou (produtos ou cuidados)?", placeholder: "Ex.: hidratante X, limpeza" },
  { id: "como_se_sente", label: "Como você se sente em relação à sua pele?", placeholder: "Ex.: incomodado, quer melhorar" },
];

export async function init() {
  step = 0;
  state = { consentimento: false, menor_responsavel: "", imagens: [], respostas: {} };
  render();
}

function render() {
  if (!app) return;
  if (step === 0) renderConsent();
  else if (step === 1) renderFotos();
  else if (step === 2) renderPerguntas();
  else if (step === 3) renderEnviando();
  else if (step === 4) renderResultado();
  else if (step === 5) renderListaAnalises();
}

function renderConsent() {
  app.innerHTML = `
    <section class="client-header">
      <h2>Análise de pele</h2>
      <p class="client-hint">Uma pré-anamnese visual para organizar suas queixas e preparar o cuidado com um profissional. A IA organiza; o profissional valida.</p>
    </section>
    <section class="analise-pele-consent">
      <p class="analise-pele-instruction">Para continuar, precisamos das suas fotos e respostas. As imagens serão usadas apenas para análise preliminar e validação pela clínica.</p>
      <label class="analise-pele-checkbox">
        <input type="checkbox" id="consentimentoImagens" required>
        Autorizo o uso das imagens apenas para análise preliminar e validação pela clínica.
      </label>
      <label class="analise-pele-optional">Sou menor de idade — nome do responsável legal (opcional)</label>
      <input type="text" id="menorResponsavel" placeholder="Nome do responsável" class="analise-pele-input">
      <button type="button" id="btnAvancarConsent" class="btn-primary">Continuar</button>
    </section>
  `;
  document.getElementById("btnAvancarConsent").onclick = () => {
    const cb = document.getElementById("consentimentoImagens");
    if (!cb?.checked) {
      toast("Marque que autoriza o uso das imagens para continuar.");
      return;
    }
    state.consentimento = true;
    state.menor_responsavel = document.getElementById("menorResponsavel")?.value?.trim() || "";
    step = 1;
    render();
  };
}

function renderFotos() {
  app.innerHTML = `
    <section class="client-header">
      <h2>Fotos da pele</h2>
      <p class="client-hint">Precisamos de pelo menos duas fotos: frontal e lateral. Use luz natural, sem maquiagem. Você pode repetir se quiser.</p>
    </section>
    <section class="analise-pele-fotos">
      <p class="analise-pele-instruction">Imagem é entrada para contexto; não substitui a avaliação de um profissional.</p>
      <div class="analise-pele-foto-slots">
        <div class="analise-pele-slot" data-tipo="frontal">
          <span class="analise-pele-slot-label">Frontal</span>
          <div id="previewFrontal" class="analise-pele-preview"></div>
          <input type="file" id="fileFrontal" accept="image/*" capture="user" class="hidden">
          <button type="button" id="btnFrontal" class="btn-secondary">Tirar ou escolher foto</button>
        </div>
        <div class="analise-pele-slot" data-tipo="lateral">
          <span class="analise-pele-slot-label">Lateral</span>
          <div id="previewLateral" class="analise-pele-preview"></div>
          <input type="file" id="fileLateral" accept="image/*" capture="user" class="hidden">
          <button type="button" id="btnLateral" class="btn-secondary">Tirar ou escolher foto</button>
        </div>
      </div>
      <button type="button" id="btnAvancarFotos" class="btn-primary">Continuar para as perguntas</button>
    </section>
  `;

  function setupSlot(tipo, fileId, previewId, btnId) {
    const file = document.getElementById(fileId);
    const preview = document.getElementById(previewId);
    const btn = document.getElementById(btnId);
    if (!file || !preview || !btn) return;
    btn.onclick = () => file.click();
    file.onchange = (e) => {
      const f = e.target?.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const idx = tipo === "frontal" ? 0 : 1;
        state.imagens[idx] = dataUrl;
        preview.innerHTML = `<img src="${dataUrl}" alt="Preview" class="analise-pele-preview-img">`;
      };
      reader.readAsDataURL(f);
    };
  }
  setupSlot("frontal", "fileFrontal", "previewFrontal", "btnFrontal");
  setupSlot("lateral", "fileLateral", "previewLateral", "btnLateral");

  document.getElementById("btnAvancarFotos").onclick = () => {
    const hasFrontal = state.imagens[0];
    const hasLateral = state.imagens[1];
    if (!hasFrontal || !hasLateral) {
      toast("Adicione as duas fotos (frontal e lateral) para continuar.");
      return;
    }
    step = 2;
    render();
  };
}

function renderPerguntas() {
  const fields = PERGUNTAS.map(
    (p) => `
    <label class="analise-pele-label">${p.label}</label>
    <input type="text" id="resposta_${p.id}" placeholder="${p.placeholder}" class="analise-pele-input" value="${escapeHtml(state.respostas[p.id] || "")}">
  `
  ).join("");
  app.innerHTML = `
    <section class="client-header">
      <h2>Algumas perguntas</h2>
      <p class="client-hint">Suas respostas ajudam a organizar a pré-anamnese e a relacionar com o que a análise visual observa.</p>
    </section>
    <section class="analise-pele-perguntas">
      ${fields}
      <button type="button" id="btnEnviarAnalise" class="btn-primary">Enviar análise</button>
    </section>
  `;
  PERGUNTAS.forEach((p) => {
    const el = document.getElementById(`resposta_${p.id}`);
    if (el) el.oninput = () => (state.respostas[p.id] = el.value.trim());
  });
  document.getElementById("btnEnviarAnalise").onclick = () => {
    step = 3;
    render();
    doSubmit();
  };
}

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

async function doSubmit() {
  try {
    const payload = {
      consentimento_imagens: state.consentimento,
      menor_responsavel: state.menor_responsavel || null,
      imagens: state.imagens.filter(Boolean),
      respostas: state.respostas,
    };
    const json = await submitAnalisePele(payload);
    state.resultado = json;
    step = 4;
    render();
  } catch (err) {
    console.error(err);
    toast(err.message || "Erro ao enviar análise.");
    step = 2;
    render();
  }
}

function renderEnviando() {
  app.innerHTML = `
    <section class="client-header">
      <h2>Enviando sua análise</h2>
      <p class="client-hint">Aguarde enquanto organizamos as informações. Isso não substitui a avaliação de um profissional.</p>
    </section>
    <section class="analise-pele-enviando">
      <p>Processando…</p>
    </section>
  `;
}

function renderResultado() {
  // Cliente NÃO vê texto preliminar da IA. Só vê devolutiva após a clínica validar (evita ansiedade e autoatuação).
  app.innerHTML = `
    <section class="client-header">
      <h2>Análise recebida</h2>
      <p class="client-hint">Sua análise foi recebida. A clínica validará e você receberá o retorno em breve.</p>
    </section>
    <section class="analise-pele-resultado">
      <div class="analise-pele-recebido">
        <p><strong>Próximo passo:</strong> Um profissional da clínica validará sua análise e entrará em contato com a devolutiva. Isso não é um diagnóstico; o profissional orientará com segurança.</p>
        <p class="analise-pele-remoto">Se preferir, entre em contato com a clínica pelo canal que você já usa.</p>
      </div>
      <button type="button" id="btnVerAnalises" class="btn-secondary">Ver minhas análises</button>
      <button type="button" id="btnVoltarDashboard" class="btn-primary">Voltar ao início</button>
    </section>
  `;
  document.getElementById("btnVerAnalises").onclick = () => {
    step = 5;
    render();
  };
  document.getElementById("btnVoltarDashboard").onclick = () => {
    window.location.hash = "#dashboard";
  };
}

async function renderListaAnalises() {
  app.innerHTML = "<p>Carregando suas análises…</p>";
  try {
    const list = await getAnalisesPeleByToken();
    const items = list.length
      ? list.map((a) => {
          const statusLabel = a.status === "pending_validation" ? "Aguardando validação" : a.status === "validated" || a.status === "incorporated" ? "Validada pela clínica" : a.status;
          const devolutiva = (a.texto_validado || "").trim();
          const temDevolutiva = devolutiva.length > 0;
          return `
        <div class="analise-pele-item ${temDevolutiva ? "analise-pele-item--com-devolutiva" : ""}">
          <div class="analise-pele-item-header">
            <small>${new Date(a.created_at).toLocaleDateString("pt-BR")}</small>
            <span class="analise-pele-status">${statusLabel}</span>
          </div>
          ${temDevolutiva ? `<div class="analise-pele-devolutiva">${devolutiva.split("\n").map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</div>` : ""}
          ${!temDevolutiva && (a.status === "validated" || a.status === "incorporated") ? '<p class="analise-pele-sem-texto">Devolutiva disponível em contato com a clínica.</p>' : ""}
        </div>
      `;
        }).join("")
      : "<p>Nenhuma análise ainda.</p>";
    app.innerHTML = `
      <section class="client-header">
        <h2>Suas análises</h2>
        <p class="client-hint">Acompanhe o status. A devolutiva aparece aqui somente após a clínica validar.</p>
      </section>
      <section class="analise-pele-lista">
        ${items}
        <button type="button" id="btnNovaAnalise" class="btn-primary">Nova análise de pele</button>
        <button type="button" id="btnVoltarDashboard2" class="btn-secondary">Voltar ao início</button>
      </section>
    `;
    document.getElementById("btnNovaAnalise").onclick = () => {
      step = 0;
      state = { consentimento: false, menor_responsavel: "", imagens: [], respostas: {} };
      render();
    };
    document.getElementById("btnVoltarDashboard2").onclick = () => {
      window.location.hash = "#dashboard";
    };
  } catch (err) {
    toast(err.message || "Erro ao carregar análises.");
    app.innerHTML = `<p>Erro ao carregar. <button type="button" id="btnRetry">Tentar de novo</button></p>`;
    document.getElementById("btnRetry").onclick = () => { step = 5; render(); };
  }
}
