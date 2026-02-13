import {
  getClientes,
  getClientById,
  createClient,
  getClientByCpf,
  uploadClientPhoto,
  updateClient,
  createClientPortalSession,
  CLIENT_STATES,
} from "../services/clientes.service.js";
import { importarLote } from "../services/importacao-lote.service.js";
import { getActiveOrg } from "../core/org.js";
import { audit } from "../services/audit.service.js";
import { checkPermission } from "../core/permissions.js";
import { openModal, closeModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { navigate } from "../core/spa.js";

let clientes = [];
let canEdit = false;
/** Stream da câmera (controlado pela view para fechar ao salvar/cancelar) */
let cameraStream = null;
/** Data URL da foto capturada pela câmera (garante uso no submit mesmo antes do toBlob) */
let capturedPhotoDataUrl = null;
/** Blob da foto capturada (preenchido assincronamente pelo toBlob) */
let capturedPhotoBlob = null;

export async function init() {
  canEdit = (await checkPermission("clientes:manage")) || (await checkPermission("clientes:edit"));
  await loadClientes();
  bindUI();
}

function bindImportClientes() {
  const btn = document.getElementById("btnImportarClientes");
  const input = document.getElementById("importClientesFile");
  if (!btn || !input) return;
  btn.onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    input.value = "";
    const pularDuplicados = document.getElementById("clientesPularDuplicados")?.checked !== false;
    try {
      const r = await importarLote("clientes", file, { pularDuplicados });
      let msg = r.inseridos ? r.inseridos + " cliente(s) importado(s)." : "Nenhum importado.";
      if (r.ignorados_duplicados > 0) msg += " " + r.ignorados_duplicados + " duplicado(s) ignorado(s).";
      toast(msg);
      if (r.erros?.length) toast("Erros: " + r.erros.length + " linha(s).", "warn");
      await loadClientes();
    } catch (e) {
      toast(e.message || "Erro ao importar.");
    }
  };
}

/* =========================
   LOAD
========================= */

async function loadClientes() {
  const search = document.getElementById("clientesSearch")?.value?.trim() || "";
  const state = document.getElementById("clientesFilterState")?.value || "";

  try {
    clientes = await getClientes({
      search: search || undefined,
      state: state || undefined,
    });
    renderClientes();
  } catch (err) {
    console.error("[Clientes] loadClientes falhou:", err);
    clientes = [];
    renderClientes();
    const msg = err?.message || err?.error_description || String(err);
    toast(msg.includes("app.org_id") ? "Erro de permissão: rode o SQL supabase-rls-clients-fix.sql no Supabase" : "Erro ao carregar clientes");
  }
}

/* =========================
   RENDER
========================= */

function stateLabel(stateOrStatus) {
  if (!stateOrStatus) return "—";
  return CLIENT_STATES[stateOrStatus] || (stateOrStatus === "active" ? "Em acompanhamento" : stateOrStatus === "archived" ? "Arquivado" : stateOrStatus);
}

function renderClientes() {
  const tbody = document.getElementById("listaClientes");
  const emptyEl = document.getElementById("clientesEmpty");
  if (!tbody) return;

  if (!clientes.length) {
    tbody.innerHTML = "";
    if (emptyEl) {
      emptyEl.classList.remove("hidden");
      emptyEl.textContent = "Nenhum cliente encontrado.";
    }
    return;
  }

  if (emptyEl) emptyEl.classList.add("hidden");

  tbody.innerHTML = clientes
    .map(
      (c) => {
        const avatar = c.avatar_url
          ? `<img class="clientes-avatar" src="${String(c.avatar_url).replace(/"/g, "&quot;")}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling?.classList.remove('hidden')">`
          : "";
        const initials = (c.name || "")
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase() || "?";
        return `
    <tr class="clientes-row" data-id="${c.id}" role="button" tabindex="0">
      <td>
        <div class="clientes-row-name">
          <span class="clientes-avatar-wrap">
            ${avatar}
            <span class="clientes-avatar-initials ${avatar ? "hidden" : ""}">${escapeHtml(initials)}</span>
          </span>
          <strong>${escapeHtml(c.name || "")}</strong>
        </div>
      </td>
      <td><span class="clientes-state clientes-state-${(c.state || c.status || "").replace("_", "-")}">${stateLabel(c.state || c.status)}</span></td>
      <td>${escapeHtml(c.phone || c.email || "—")}</td>
      <td>${formatDate(c.created_at)}</td>
      <td class="clientes-col-acoes">${canEdit ? `<button type="button" class="btn-secondary btn-sm btn-editar-cliente" data-id="${c.id}" title="Editar cliente">Editar</button>` : ""}</td>
    </tr>
  `;
      }
    )
    .join("");

  bindEditEvents();
}

function escapeHtml(s) {
  if (!s) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

/* =========================
   UI BINDINGS
========================= */

function bindUI() {
  const btnNovo = document.getElementById("btnNovoCliente");
  if (btnNovo) btnNovo.addEventListener("click", openCreateModal);

  const searchEl = document.getElementById("clientesSearch");
  if (searchEl) {
    searchEl.addEventListener("input", debounce(loadClientes, 300));
    searchEl.addEventListener("keydown", (e) => e.key === "Enter" && loadClientes());
  }

  const filterState = document.getElementById("clientesFilterState");
  if (filterState) filterState.addEventListener("change", loadClientes);

  bindImportClientes();

  const btnModelo = document.getElementById("btnModeloClientes");
  if (btnModelo) {
    btnModelo.onclick = (e) => {
      e.preventDefault();
      const headers = getTemplateHeaders("clientes");
      const line = headers.join(";");
      const blob = new Blob([line + "\n"], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "modelo_clientes.csv";
      a.click();
      toast("Modelo baixado!");
    };
  }
}

function bindEditEvents() {
  document.querySelectorAll(".clientes-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".btn-editar-cliente")) return;
      openPerfil(row.dataset.id);
    });
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPerfil(row.dataset.id);
      }
    });
  });
  document.querySelectorAll(".btn-editar-cliente").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!id) return;
      sessionStorage.setItem("clientePerfilId", id);
      sessionStorage.setItem("clientePerfilOpenEdit", "1");
      navigate("cliente-perfil");
    });
  });
}

function openPerfil(clientId) {
  if (!clientId) return;
  sessionStorage.setItem("clientePerfilId", clientId);
  navigate("cliente-perfil");
}

function debounce(fn, ms) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

/** Converte data URL (base64) em Blob — versão síncrona para usar no momento da captura. */
function dataUrlToBlobSync(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const i = dataUrl.indexOf(",");
  if (i === -1) return null;
  const base64 = dataUrl.slice(i + 1);
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
    return new Blob([bytes], { type: "image/jpeg" });
  } catch (e) {
    return null;
  }
}

/** Converte data URL (base64) em Blob — versão assíncrona (Promise). */
function dataUrlToBlob(dataUrl) {
  return Promise.resolve(dataUrlToBlobSync(dataUrl));
}

/* =========================
   MODAL: ADICIONAR CLIENTE
========================= */

function maskCpf(input) {
  let v = input.value.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  input.value = v;
}

/** Máscara (00) 00000-0000 celular ou (00) 0000-0000 fixo */
function maskPhone(input) {
  let v = input.value.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 6) {
    if (v[2] === "9") v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
    else v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  } else if (v.length > 2) {
    v = v.replace(/(\d{2})(\d{0,4})/, "($1) $2");
  } else if (v.length) {
    v = "(" + v;
  }
  input.value = v;
}

/** Encerra o hardware: para cada track do MediaStream (limpa trilhos). Fechar o vídeo não desliga o LED da câmera. */
function fecharCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  const v = document.getElementById("cameraVideo");
  if (v) v.srcObject = null;
  const area = document.getElementById("clientesCameraArea");
  if (area) area.classList.add("hidden");
}

function openCreateModal() {
  capturedPhotoDataUrl = null;
  capturedPhotoBlob = null;
  cameraStream = null;

  openModal(
    "Adicionar cliente",
    `
    <label>Foto (opcional)</label>
    <div class="clientes-foto-wrap">
      <input type="file" id="clientPhoto" accept="image/jpeg,image/png,image/webp,image/gif" class="clientes-foto-input">
      <div class="clientes-foto-buttons">
        <button type="button" class="clientes-foto-btn" id="btnEscolherFoto">Escolher arquivo</button>
        <button type="button" class="clientes-foto-btn clientes-foto-btn-camera" id="btnTirarFoto">Tirar foto (câmera)</button>
      </div>
      <div class="clientes-camera-area hidden" id="clientesCameraArea">
        <video id="cameraVideo" class="clientes-camera-video" autoplay playsinline muted></video>
        <button type="button" class="clientes-foto-btn clientes-foto-btn-capture" id="btnCapturarFoto">Capturar foto</button>
      </div>
      <div class="clientes-foto-preview" id="clientPhotoPreview"></div>
    </div>
    <label>Nome completo <span class="required">*</span></label>
    <input id="name" required placeholder="Nome completo">
    <label>CPF (evita duplicado)</label>
    <input id="cpf" type="text" placeholder="000.000.000-00" maxlength="14">
    <p id="cpfDuplicateWarning" class="form-warning hidden" role="alert"></p>
    <label>Telefone</label>
    <input id="phone" type="tel" placeholder="(00) 00000-0000" maxlength="15">
    <label>E-mail</label>
    <input id="email" type="email" placeholder="email@exemplo.com">
    <p class="form-hint">Informe pelo menos telefone ou e-mail.</p>
    <label>Data de nascimento</label>
    <input id="birth_date" type="date">
    <label>Sexo</label>
    <select id="sex">
      <option value="">—</option>
      <option value="F">Feminino</option>
      <option value="M">Masculino</option>
      <option value="Outro">Outro</option>
    </select>
    <label>Observações iniciais</label>
    <textarea id="notes" rows="2" placeholder="Opcional"></textarea>
    <label>Estado inicial</label>
    <select id="state">
      <option value="em_acompanhamento">Em acompanhamento</option>
      <option value="pre_cadastro">Pré-cadastro</option>
    </select>
  `,
    createCliente,
    fecharCamera
  );
  const cpfInput = document.getElementById("cpf");
  const cpfWarning = document.getElementById("cpfDuplicateWarning");
  if (cpfInput) {
    cpfInput.addEventListener("input", () => {
      maskCpf(cpfInput);
      if (cpfWarning) {
        cpfWarning.classList.add("hidden");
        cpfWarning.textContent = "";
      }
    });
    cpfInput.addEventListener("blur", async () => {
      const raw = cpfInput.value.replace(/\D/g, "");
      if (raw.length !== 11 || !cpfWarning) return;
      try {
        const existing = await getClientByCpf(raw);
        if (existing) {
          cpfWarning.textContent = "Já existe um cliente com este CPF: " + (existing.name || "cliente cadastrado") + ". Evite cadastrar de novo.";
          cpfWarning.classList.remove("hidden");
        } else {
          cpfWarning.classList.add("hidden");
          cpfWarning.textContent = "";
        }
      } catch (e) {
        console.warn("[Clientes] Verificação CPF:", e);
      }
    });
  }
  const phoneInput = document.getElementById("phone");
  if (phoneInput) phoneInput.addEventListener("input", () => maskPhone(phoneInput));

  const photoInput = document.getElementById("clientPhoto");
  const btnFoto = document.getElementById("btnEscolherFoto");
  const btnTirar = document.getElementById("btnTirarFoto");
  const preview = document.getElementById("clientPhotoPreview");
  const cameraArea = document.getElementById("clientesCameraArea");
  const videoEl = document.getElementById("cameraVideo");
  const btnCapturar = document.getElementById("btnCapturarFoto");

  if (btnFoto && photoInput) {
    btnFoto.addEventListener("click", () => photoInput.click());
    photoInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!preview) return;
      capturedPhotoDataUrl = null;
      capturedPhotoBlob = null;
      fecharCamera();
      if (!file) {
        preview.innerHTML = "";
        preview.classList.add("hidden");
        btnFoto.textContent = "Escolher arquivo";
        return;
      }
      const url = URL.createObjectURL(file);
      preview.innerHTML = `<img src="${url}" alt="Preview" class="clientes-foto-preview-img">`;
      preview.classList.remove("hidden");
      btnFoto.textContent = "Trocar arquivo";
    });
  }

  if (btnTirar) {
    btnTirar.addEventListener("click", () => abrirCamera());
  }
  if (btnCapturar) {
    btnCapturar.addEventListener("click", () => tirarFoto());
  }

  async function abrirCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast("Câmera não disponível neste navegador.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      cameraStream = stream;
      if (!videoEl || !cameraArea) return;
      videoEl.srcObject = stream;
      await videoEl.play();
      cameraArea.classList.remove("hidden");
      const wrap = document.querySelector(".clientes-foto-wrap");
      if (wrap) wrap.classList.remove("is-capturing");
      if (preview) preview.innerHTML = "";
      if (photoInput) photoInput.value = "";
      if (btnFoto) btnFoto.textContent = "Escolher arquivo";
      // Garante que o vídeo e o botão "Capturar foto" fiquem visíveis no modal
      requestAnimationFrame(() => {
        btnCapturar?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } catch (err) {
      console.warn("[Clientes] Câmera:", err);
      toast("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  }

  function tirarFoto() {
    const video = document.getElementById("cameraVideo");
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast("Aguarde a câmera carregar.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 1. Congelar: Base64 no avatar de imediato (síncrono)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    capturedPhotoDataUrl = dataUrl;
    // Blob para upload já no momento da captura (síncrono) — garante uso no submit
    const blobSync = dataUrlToBlobSync(dataUrl);
    if (blobSync && blobSync.size > 0) {
      capturedPhotoBlob = blobSync;
    }
    if (preview) {
      preview.innerHTML = "";
      const img = document.createElement("img");
      img.alt = "Preview";
      img.className = "clientes-foto-preview-img";
      img.src = dataUrl;
      preview.appendChild(img);
      preview.classList.remove("hidden");
    }
    // 2. Esconder vídeo e mostrar foto (estado visual)
    if (cameraArea) cameraArea.classList.add("hidden");
    const wrap = document.querySelector(".clientes-foto-wrap");
    if (wrap) wrap.classList.add("is-capturing");
    // 3. Limpa trilhos: desliga o hardware imediatamente após capturar
    fecharCamera();
    if (btnFoto) btnFoto.textContent = "Trocar arquivo";
  }
}

async function createCliente() {
  fecharCamera();

  const name = document.getElementById("name")?.value?.trim();
  const cpf = document.getElementById("cpf")?.value?.trim() || null;
  const phone = document.getElementById("phone")?.value?.trim() || null;
  const email = document.getElementById("email")?.value?.trim() || null;
  const birth_date = document.getElementById("birth_date")?.value || null;
  const sex = document.getElementById("sex")?.value || null;
  const notes = document.getElementById("notes")?.value?.trim() || null;
  const state = document.getElementById("state")?.value || "em_acompanhamento";
  let photoFile = document.getElementById("clientPhoto")?.files?.[0];
  // Prioridade 1: blob da câmera (definido no momento da captura)
  if (!photoFile && capturedPhotoBlob && capturedPhotoBlob.size > 0) {
    photoFile = new File([capturedPhotoBlob], "avatar.jpg", { type: "image/jpeg" });
  }
  // Prioridade 2: data URL da câmera (fallback se blob não foi setado)
  if (!photoFile && capturedPhotoDataUrl) {
    const blob = dataUrlToBlobSync(capturedPhotoDataUrl);
    if (blob && blob.size > 0) photoFile = new File([blob], "avatar.jpg", { type: "image/jpeg" });
  }
  // Prioridade 3: preview do DOM (img com data URL ou blob URL)
  if (!photoFile) {
    const previewEl = document.getElementById("clientPhotoPreview");
    const previewImg = previewEl?.querySelector("img");
    if (previewImg?.src) {
      try {
        const blob = previewImg.src.startsWith("data:")
          ? dataUrlToBlobSync(previewImg.src)
          : await fetch(previewImg.src).then((r) => r.blob());
        if (blob && blob.size > 0) photoFile = new File([blob], "avatar.jpg", { type: blob.type || "image/jpeg" });
      } catch (e) {
        console.warn("[Clientes] Fallback preview→blob falhou:", e);
      }
    }
  }
  if (!photoFile && (capturedPhotoDataUrl || capturedPhotoBlob)) {
    toast("Não foi possível preparar a foto. Tente capturar de novo.");
  }

  if (!name) {
    toast("Nome é obrigatório");
    return;
  }
  if (!phone && !email) {
    toast("Informe telefone ou e-mail");
    return;
  }

  try {
    const client = await createClient({
      name,
      cpf: cpf || undefined,
      phone,
      email,
      birth_date: birth_date || undefined,
      sex: sex || undefined,
      notes: notes || undefined,
      state,
    });

    let avatarUrlForList = null;
    if (photoFile && client?.id) {
      const orgId = getActiveOrg();
      if (orgId) {
        try {
          const avatarUrl = await uploadClientPhoto(orgId, client.id, photoFile);
          if (avatarUrl) {
            await updateClient(client.id, { avatar_url: avatarUrl });
            avatarUrlForList = avatarUrl;
          }
        } catch (e) {
          console.warn("[Clientes] Upload da foto falhou:", e);
          toast("Cliente criado, mas a foto não foi enviada. Verifique o bucket 'client-photos' e as políticas RLS no Supabase.");
        }
      }
    }

    await audit({
      action: "cliente.create",
      tableName: "clients",
      recordId: client.id,
      permissionUsed: "clientes:manage",
    });

    closeModal();
    await new Promise((r) => setTimeout(r, 400));
    await loadClientes();
    toast("Cliente criado");
    if (state === "pre_cadastro" && client?.id) {
      try {
        const { url } = await createClientPortalSession(client.id);
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          toast("Link para o cliente completar o cadastro foi copiado. Envie para o cliente.");
        } else {
          setTimeout(() => prompt("Copie o link e envie para o cliente completar o cadastro:", url), 500);
        }
      } catch (e) {
        console.warn("[Clientes] Link portal:", e);
      }
    }
    if (client?.id) {
      const abrirAnamnese = confirm("Deseja abrir a anamnese deste cliente agora?");
      if (abrirAnamnese) {
        sessionStorage.setItem("anamnese_client_id", client.id);
        sessionStorage.removeItem("anamnese_agenda_id");
        sessionStorage.removeItem("anamnese_procedimento");
        navigate("anamnese");
      }
    }
  } catch (err) {
    console.error(err);
    const msg = err?.message || "Erro ao criar cliente";
    if (/CPF|duplicad|já existe/i.test(msg)) {
      toast(msg, "warn");
    } else {
      toast(msg);
    }
  }
}
