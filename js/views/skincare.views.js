/**
 * Skincare IA — gera rotina a partir de análise/contexto.
 * Pesquisar cliente, ficha rápida para a IA e fotos em cabine.
 */

import { gerarSkincare } from "../services/skincare.service.js";
import { createRecord } from "../services/client-records.service.js";
import { audit } from "../services/audit.service.js";
import { getClientById, getClientes } from "../services/clientes.service.js";
import { listRegistrosByClient } from "../services/anamnesis.service.js";
import { listAnalisesPeleByClient } from "../services/analise-pele.service.js";
import { getSkincareRotinaByClient, upsertSkincareRotina } from "../services/skincare-rotina.service.js";
import { openModal, closeModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";

const btnGerarSkincare = document.getElementById("btnGerarSkincare");
const resultadoSkincare = document.getElementById("resultadoSkincare");
const textareaAnalise = document.getElementById("skincareAnalise");
const textareaProtocolo = document.getElementById("skincareProtocolo");
const skincareContextoLabel = document.getElementById("skincareContextoLabel");
const skincareSalvarWrap = document.getElementById("skincareSalvarWrap");
const btnSkincareSalvarCliente = document.getElementById("btnSkincareSalvarCliente");

let skincareFotosCabine = [];
let skincareCameraStream = null;

function safeJsonOrText(val) {
  if (!val || !String(val).trim()) return {};
  try { return JSON.parse(val); } catch { return { texto: val }; }
}

/** Monta contexto (cliente + anamnese + análise de pele) para preencher o textarea. */
function buildContextForSkincare(cliente, registrosAnamnese, analisesPele) {
  const partes = [];
  if (cliente) {
    partes.push({
      cliente: {
        nome: cliente.name || cliente.nome,
        nascimento: cliente.birth_date,
        sexo: cliente.sex,
        observacoes: cliente.notes
      }
    });
  }
  if (registrosAnamnese && registrosAnamnese.length > 0) {
    partes.push({
      anamnese: registrosAnamnese.map((r) => ({
        funcao: r.anamnesis_funcoes?.nome || r.anamnesis_funcoes?.slug,
        data: r.created_at,
        conteudo: r.conteudo,
        ficha: r.ficha,
        conduta_tratamento: r.conduta_tratamento
      }))
    });
  }
  if (analisesPele && analisesPele.length > 0) {
    partes.push({
      analise_pele: analisesPele.map((a) => ({
        data: a.created_at,
        texto_validado: a.texto_validado,
        ia_preliminar: a.ia_preliminar,
        status: a.status
      }))
    });
  }
  return partes.length ? JSON.stringify(partes, null, 2) : "";
}

/** Carrega dados do cliente (e anamnese/rotina) nos campos. Usado ao vir do perfil ou ao pesquisar cliente. */
async function loadClientContext(clientId) {
  if (!clientId) return;
  if (skincareContextoLabel) {
    skincareContextoLabel.classList.add("hidden");
    skincareContextoLabel.textContent = "";
  }
  try {
    const [cliente, registrosAnamnese, analisesPele, rotinaAtual] = await Promise.all([
      getClientById(clientId).catch(() => null),
      listRegistrosByClient(clientId).catch(() => []),
      listAnalisesPeleByClient(clientId).catch(() => []),
      getSkincareRotinaByClient(clientId).catch(() => null)
    ]);
    const contextoTexto = buildContextForSkincare(cliente, registrosAnamnese, analisesPele);
    if (textareaAnalise && contextoTexto) textareaAnalise.value = contextoTexto;
    if (textareaProtocolo && rotinaAtual?.conteudo) textareaProtocolo.value = rotinaAtual.conteudo;
    if (skincareContextoLabel && cliente) {
      skincareContextoLabel.textContent = "Contexto carregado: " + (cliente.name || cliente.nome);
      skincareContextoLabel.classList.remove("hidden");
    }
    sessionStorage.setItem("skincare_client_id", clientId);
    toast("Contexto do cliente carregado.");
  } catch (err) {
    console.warn("[SKINCARE] loadClientContext:", err);
    toast("Não foi possível carregar os dados do cliente.", "error");
  }
}

/**
 * Inicializa a view: só importa dados do cliente quando o usuário veio do perfil ("Gerar rotina com IA").
 * Se abrir Skincare pelo menu, os campos ficam vazios.
 */
export async function init() {
  const fromProfile = sessionStorage.getItem("skincare_from_profile") === "1";
  const clientId = sessionStorage.getItem("skincare_client_id") || sessionStorage.getItem("clientePerfilId");

  if (skincareContextoLabel) {
    skincareContextoLabel.classList.add("hidden");
    skincareContextoLabel.textContent = "";
  }
  if (skincareSalvarWrap) skincareSalvarWrap.classList.add("hidden");

  if (!fromProfile) {
    sessionStorage.removeItem("skincare_client_id");
    if (textareaAnalise) textareaAnalise.value = "";
    if (textareaProtocolo) textareaProtocolo.value = "";
  } else {
    sessionStorage.removeItem("skincare_from_profile");
    if (clientId) await loadClientContext(clientId);
  }

  bindPesquisarCliente();
  bindFichaRapida();
  bindFotosCabine();
}

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function bindPesquisarCliente() {
  const btn = document.getElementById("btnSkincarePesquisarCliente");
  if (!btn) return;
  btn.onclick = () => {
    openModal(
      "Pesquisar cliente",
      `
      <label>Nome ou e-mail</label>
      <input type="text" id="skincareSearchCliente" placeholder="Digite para buscar…" autocomplete="off">
      <div id="skincareClientesLista" class="skincare-clientes-lista"></div>
      <p class="form-hint">Selecione um cliente para carregar dados e anamnese no contexto da IA.</p>
      `,
      () => {},
      () => {}
    );
    const input = document.getElementById("skincareSearchCliente");
    const lista = document.getElementById("skincareClientesLista");
    if (!input || !lista) return;

    let timeout = null;
    input.oninput = () => {
      clearTimeout(timeout);
      const q = input.value?.trim() || "";
      if (q.length < 2) {
        lista.innerHTML = q ? "<p class=\"form-hint\">Digite ao menos 2 caracteres.</p>" : "<p class=\"form-hint\">Busque por nome ou e-mail.</p>";
        return;
      }
      timeout = setTimeout(async () => {
        try {
          const clientes = await getClientes({ search: q });
          if (clientes.length === 0) {
            lista.innerHTML = "<p class=\"form-hint\">Nenhum cliente encontrado.</p>";
            return;
          }
          lista.innerHTML = `
            <ul class="skincare-clientes-ul">
              ${clientes.slice(0, 15).map((c) => `
                <li><button type="button" class="skincare-cliente-btn" data-id="${escapeHtml(c.id)}">${escapeHtml(c.name || c.nome || "Sem nome")}</button></li>
              `).join("")}
            </ul>
          `;
          lista.querySelectorAll(".skincare-cliente-btn").forEach((b) => {
            b.onclick = async () => {
              const id = b.dataset.id;
              closeModal();
              if (id) await loadClientContext(id);
            };
          });
        } catch (e) {
          lista.innerHTML = "<p class=\"form-hint\">Erro ao buscar.</p>";
        }
      }, 300);
    };
    input.focus();
    lista.innerHTML = "<p class=\"form-hint\">Digite ao menos 2 caracteres para buscar.</p>";
  };
}

function bindFichaRapida() {
  const btn = document.getElementById("btnSkincareFichaRapida");
  if (!btn) return;
  btn.onclick = () => {
    openModal(
      "Ficha rápida (para a IA)",
      `
      <p class="form-hint">Preencha os campos para a IA usar na análise. O texto será adicionado ao contexto.</p>
      <label>Queixa principal</label>
      <textarea id="fichaQueixa" rows="2" placeholder="Ex.: melasma, acne, oleosidade…"></textarea>
      <label>Fototipo</label>
      <input type="text" id="fichaFototipo" placeholder="Ex.: III">
      <label>Sensibilidade / alergias</label>
      <input type="text" id="fichaSensibilidade" placeholder="Ex.: nenhuma, ácidos…">
      <label>Produtos em uso</label>
      <textarea id="fichaProdutos" rows="2" placeholder="Rotina atual, dermocosméticos…"></textarea>
      <label>Observações</label>
      <textarea id="fichaObs" rows="2" placeholder="Outras informações relevantes"></textarea>
      `,
      () => {
        const queixa = document.getElementById("fichaQueixa")?.value?.trim() || "";
        const fototipo = document.getElementById("fichaFototipo")?.value?.trim() || "";
        const sensibilidade = document.getElementById("fichaSensibilidade")?.value?.trim() || "";
        const produtos = document.getElementById("fichaProdutos")?.value?.trim() || "";
        const obs = document.getElementById("fichaObs")?.value?.trim() || "";
        const ficha = { queixa_principal: queixa || null, fototipo: fototipo || null, sensibilidade_alergias: sensibilidade || null, produtos_em_uso: produtos || null, observacoes: obs || null };
        const texto = JSON.stringify({ ficha_rapida_cabine: ficha }, null, 2);
        if (textareaAnalise) {
          const atual = textareaAnalise.value?.trim() || "";
          textareaAnalise.value = atual ? atual + "\n\n" + texto : texto;
        }
        closeModal();
        toast("Ficha adicionada ao contexto.");
      },
      () => {}
    );
  };
}

function fecharCameraSkincare() {
  if (skincareCameraStream) {
    skincareCameraStream.getTracks().forEach((t) => t.stop());
    skincareCameraStream = null;
  }
  const cam = document.getElementById("skincareFotosCabineCamera");
  if (cam) cam.classList.add("hidden");
}

function bindFotosCabine() {
  const btnAbrir = document.getElementById("btnSkincareFotosCabine");
  const wrap = document.getElementById("skincareFotosCabineWrap");
  const btnEscolher = document.getElementById("btnSkincareFotosEscolher");
  const inputFile = document.getElementById("skincareFotosCabineInput");
  const btnCamera = document.getElementById("btnSkincareFotosCamera");
  const areaCamera = document.getElementById("skincareFotosCabineCamera");
  const video = document.getElementById("skincareCameraVideo");
  const btnCapturar = document.getElementById("btnSkincareCapturar");
  const preview = document.getElementById("skincareFotosPreview");

  if (btnAbrir && wrap) {
    btnAbrir.onclick = () => {
      wrap.classList.toggle("hidden");
      if (!wrap.classList.contains("hidden")) return;
      fecharCameraSkincare();
    };
  }

  if (btnEscolher && inputFile) {
    btnEscolher.onclick = () => inputFile.click();
    inputFile.onchange = (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      files.forEach((file) => {
        if (!file.type.startsWith("image/")) return;
        const url = URL.createObjectURL(file);
        skincareFotosCabine.push(url);
        if (preview) {
          const img = document.createElement("img");
          img.src = url;
          img.alt = "Foto cabine";
          preview.appendChild(img);
        }
      });
      if (skincareFotosCabine.length > 0 && textareaAnalise) {
        const v = textareaAnalise.value || "";
        if (!v.includes("Fotos em cabine:")) textareaAnalise.value = (v.trim() + "\n\n[Fotos em cabine: " + skincareFotosCabine.length + " imagem(ns) anexada(s) para avaliação presencial.]").trim();
      }
    };
  }

  if (btnCamera && areaCamera && video) {
    btnCamera.onclick = async () => {
      if (skincareCameraStream) {
        areaCamera.classList.toggle("hidden");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        toast("Câmera não disponível.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
        });
        skincareCameraStream = stream;
        video.srcObject = stream;
        await video.play();
        areaCamera.classList.remove("hidden");
      } catch (err) {
        toast("Não foi possível acessar a câmera.");
      }
    };
  }

  if (btnCapturar && video && preview) {
    btnCapturar.onclick = () => {
      if (!video.srcObject) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      skincareFotosCabine.push(dataUrl);
      const img = document.createElement("img");
      img.src = dataUrl;
      img.alt = "Foto cabine";
      preview.appendChild(img);
      fecharCameraSkincare();
      if (textareaAnalise && skincareFotosCabine.length > 0) {
        const v = textareaAnalise.value || "";
        if (!v.includes("Fotos em cabine:")) textareaAnalise.value = (v.trim() + "\n\n[Fotos em cabine: " + skincareFotosCabine.length + " imagem(ns) anexada(s) para avaliação presencial.]").trim();
      }
    };
  }
}

function bindGerar() {
  if (!btnGerarSkincare || !resultadoSkincare) return;

  btnGerarSkincare.onclick = async () => {
    const analiseAtual = safeJsonOrText(textareaAnalise?.value);
    const protocoloAtual = safeJsonOrText(textareaProtocolo?.value);
    const payload = { analise: analiseAtual, protocolo: protocoloAtual };

    if (skincareFotosCabine.length > 0) {
      const fotosBase64 = await Promise.all(skincareFotosCabine.map(async (url) => {
        if (typeof url === "string" && url.startsWith("data:")) return url;
        try {
          const r = await fetch(url);
          const blob = await r.blob();
          return await new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result);
            fr.onerror = rej;
            fr.readAsDataURL(blob);
          });
        } catch (_) { return null; }
      }));
      payload.fotos = fotosBase64.filter(Boolean);
    }

    resultadoSkincare.innerText = "Gerando rotina...";
    if (skincareSalvarWrap) skincareSalvarWrap.classList.add("hidden");

    try {
      const res = await gerarSkincare(payload);
      const content = res?.content ?? res?.message ?? (typeof res === "string" ? res : null);
      resultadoSkincare.innerText = content ? String(content) : JSON.stringify(res) || "Sem resposta.";

      const idCliente = sessionStorage.getItem("skincare_client_id") || sessionStorage.getItem("clientePerfilId");
      const idProtocolo = sessionStorage.getItem("skincare_protocol_id");

      if (idCliente && content && idProtocolo) {
        try {
          const record = await createRecord({
            clientId: idCliente,
            protocolId: idProtocolo,
            recordType: "ai_analysis",
            visibility: "internal",
            content: res
          });
          await audit({
            action: "cliente.ai.analysis",
            tableName: "client_records",
            recordId: record.id,
            permissionUsed: "clientes:manage",
            metadata: { source: "skincare_ai" }
          });
        } catch (e) {
          console.warn("createRecord/audit:", e);
        }
      }

      if (idCliente && content && skincareSalvarWrap) {
        skincareSalvarWrap.classList.remove("hidden");
      }
    } catch (err) {
      console.error(err);
      resultadoSkincare.innerText = "Erro: " + (err?.message || "não foi possível gerar.");
      toast(err?.message || "Erro ao gerar rotina", "error");
    }
  };
}

function bindSalvarCliente() {
  if (!btnSkincareSalvarCliente || !resultadoSkincare) return;

  btnSkincareSalvarCliente.onclick = async () => {
    const clientId = sessionStorage.getItem("skincare_client_id") || sessionStorage.getItem("clientePerfilId");
    const conteudo = resultadoSkincare.innerText?.trim();
    if (!clientId || !conteudo) {
      toast("Nada para salvar ou cliente não definido.", "warning");
      return;
    }
    try {
      await upsertSkincareRotina(clientId, { conteudo });
      toast("Rotina salva no perfil do cliente. Edite na aba Rotina skincare e libere no portal quando quiser.");
      if (skincareSalvarWrap) skincareSalvarWrap.classList.add("hidden");
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao salvar", "error");
    }
  };
}

bindGerar();
bindSalvarCliente();
