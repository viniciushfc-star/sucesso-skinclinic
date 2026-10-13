/**
 * CEP e foto do cadastro da pessoa (não da ficha clínica).
 */
import { buscarCep, maskCepInput, fillAddressFields } from "./cep.service.js";
import { getCameraStream } from "./camera.js";

export function htmlEnderecoCliente(prefix, c = {}) {
  const v = (k) => String(c[k] || "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `
    <label>CEP</label>
    <div class="empresa-cep-wrap">
      <input type="text" id="${prefix}Cep" placeholder="00000-000" maxlength="9" inputmode="numeric" value="${v("cep")}">
      <button type="button" id="${prefix}CepBuscar" class="btn-secondary btn-sm">Buscar</button>
    </div>
    <p class="form-hint">O CEP fica no cadastro da pessoa, não na anamnese.</p>
    <label>Endereço</label>
    <input type="text" id="${prefix}Endereco" placeholder="Rua, número, bairro" value="${v("endereco")}">
    <label>Complemento</label>
    <input type="text" id="${prefix}Complemento" placeholder="Apto, bloco…" value="${v("complemento")}">
    <label>Cidade</label>
    <input type="text" id="${prefix}Cidade" placeholder="Cidade" value="${v("cidade")}">
    <label>Estado</label>
    <input type="text" id="${prefix}Estado" placeholder="UF" maxlength="2" value="${v("estado")}">
  `;
}

export function bindEnderecoCliente(prefix, toast) {
  const cepEl = document.getElementById(`${prefix}Cep`);
  const btn = document.getElementById(`${prefix}CepBuscar`);
  if (cepEl) {
    maskCepInput(cepEl);
    cepEl.addEventListener("input", () => maskCepInput(cepEl));
  }
  const run = async () => {
    const raw = (cepEl?.value || "").replace(/\D/g, "");
    if (raw.length !== 8) {
      toast("Informe um CEP válido (8 dígitos).");
      return;
    }
    toast("Buscando CEP…");
    const result = await buscarCep(raw);
    if (!result) {
      toast("CEP não encontrado.");
      return;
    }
    fillAddressFields(result, {
      cidade: document.getElementById(`${prefix}Cidade`),
      estado: document.getElementById(`${prefix}Estado`),
      endereco: document.getElementById(`${prefix}Endereco`),
    }, true);
    toast("Endereço preenchido.");
  };
  if (btn) btn.addEventListener("click", run);
  if (cepEl) {
    cepEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        run();
      }
    });
  }
}

export function readEnderecoCliente(prefix) {
  const val = (id) => document.getElementById(id)?.value?.trim() || "";
  const cepRaw = val(`${prefix}Cep`).replace(/\D/g, "");
  return {
    cep: cepRaw.length === 8 ? `${cepRaw.slice(0, 5)}-${cepRaw.slice(5)}` : (cepRaw || null),
    endereco: val(`${prefix}Endereco`) || null,
    complemento: val(`${prefix}Complemento`) || null,
    cidade: val(`${prefix}Cidade`) || null,
    estado: (val(`${prefix}Estado`) || "").toUpperCase() || null,
  };
}

export function isTouchCameraDevice() {
  try {
    if (window.matchMedia?.("(pointer: coarse)").matches) return true;
  } catch (_) { /* ignore */ }
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || "");
}

export function waitVideoReady(video, ms = 10000) {
  if (video?.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("playing", onMeta);
      resolve();
    };
    const onMeta = () => {
      if (video.videoWidth > 0) done();
    };
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("playing", onMeta);
  });
}

export async function startCadastroCamera(videoEl, areaEl, facing = "user") {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("no-api");
  }
  if (areaEl) areaEl.classList.remove("hidden");
  const stream = await getCameraStream(facing);
  videoEl.srcObject = stream;
  videoEl.setAttribute("playsinline", "true");
  videoEl.muted = true;
  await videoEl.play().catch(() => {});
  await waitVideoReady(videoEl);
  return stream;
}

export function initialsFromName(name) {
  return (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] || "").toUpperCase())
    .join("") || "?";
}

/** Iniciais ficam visíveis até a foto carregar de verdade (URL morta ou 1px não esconde o nome). */
export function htmlClientAvatar(url, name, wrapClass = "") {
  const initials = initialsFromName(name).replace(/</g, "&lt;");
  const src = String(url || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const wrap = ["clientes-avatar-wrap", wrapClass].filter(Boolean).join(" ");
  const img = src
    ? `<img class="clientes-avatar" src="${src}" alt="" loading="lazy" onload="if(this.naturalWidth<8){this.style.display='none';this.nextElementSibling&&this.nextElementSibling.classList.remove('hidden')}else{this.nextElementSibling&&this.nextElementSibling.classList.add('hidden')}" onerror="this.style.display='none';this.nextElementSibling&&this.nextElementSibling.classList.remove('hidden')">`
    : "";
  return `<span class="${wrap}">${img}<span class="clientes-avatar-initials">${initials}</span></span>`;
}

export function htmlFotoCadastro(ids, { existingUrl = "" } = {}) {
  const preview = existingUrl
    ? `<img src="${String(existingUrl).replace(/"/g, "&quot;")}" alt="Foto" class="clientes-foto-preview-img">`
    : "";
  return `
    <label>Foto do rosto (cadastro)</label>
    <div class="clientes-foto-wrap">
      <input type="file" id="${ids.file}" accept="image/jpeg,image/png,image/webp,image/gif,image/*" class="clientes-foto-input">
      <input type="file" id="${ids.cameraFile}" accept="image/*" capture="user" class="clientes-foto-input">
      <input type="file" id="${ids.cameraFileEnv}" accept="image/*" capture="environment" class="clientes-foto-input">
      <div class="clientes-foto-buttons">
        <button type="button" class="clientes-foto-btn" id="${ids.btnEscolher}">Escolher arquivo</button>
        <button type="button" class="clientes-foto-btn clientes-foto-btn-camera" id="${ids.btnTirar}">Câmera frontal</button>
        <button type="button" class="clientes-foto-btn clientes-foto-btn-camera" id="${ids.btnTirarEnv}">Câmera traseira</button>
      </div>
      <div class="clientes-camera-area hidden" id="${ids.area}">
        <video id="${ids.video}" class="clientes-camera-video" autoplay playsinline muted></video>
        <button type="button" class="clientes-foto-btn clientes-foto-btn-capture" id="${ids.btnCapturar}">Capturar foto</button>
      </div>
      <div class="clientes-foto-preview" id="${ids.preview}">${preview}</div>
      <p class="form-hint">Frontal para o rosto; traseira para o corpo ou a embalagem. Cole do WhatsApp com Ctrl+V.</p>
    </div>
  `;
}

export function captureIds(prefix) {
  return {
    file: `${prefix}Photo`,
    cameraFile: `${prefix}PhotoCamera`,
    cameraFileEnv: `${prefix}PhotoCameraEnv`,
    btnEscolher: `${prefix}BtnEscolherFoto`,
    btnTirar: `${prefix}BtnTirarFoto`,
    btnTirarEnv: `${prefix}BtnTirarFotoEnv`,
    btnCapturar: `${prefix}BtnCapturarFoto`,
    area: `${prefix}CameraArea`,
    video: `${prefix}CameraVideo`,
    preview: `${prefix}PhotoPreview`,
  };
}

function dataUrlToBlobSync(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const i = dataUrl.indexOf(",");
  if (i === -1) return null;
  try {
    const binary = atob(dataUrl.slice(i + 1));
    const bytes = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
    return new Blob([bytes], { type: "image/jpeg" });
  } catch (_) {
    return null;
  }
}

export function stopCameraStream(stream, videoEl, areaEl) {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  if (videoEl) videoEl.srcObject = null;
  if (areaEl) areaEl.classList.add("hidden");
}

export function fileFromClipboardEvent(e) {
  const dt = e.clipboardData;
  if (!dt) return null;
  const items = dt.items ? [...dt.items] : [];
  for (const item of items) {
    if (item.type && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file && file.size > 0) return file;
    }
  }
  const files = dt.files ? [...dt.files] : [];
  return files.find((f) => f.type?.startsWith("image/") && f.size > 0) || null;
}

export async function downloadImageUrl(url, filename) {
  if (!url) return;
  const name = filename || "foto.jpg";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1500);
  } catch (_) {
    window.open(url, "_blank", "noopener");
  }
}

export function wireFotoCadastro(ids, state, toast) {
  const photoInput = document.getElementById(ids.file);
  const cameraFile = document.getElementById(ids.cameraFile);
  const cameraFileEnv = document.getElementById(ids.cameraFileEnv);
  const btnFoto = document.getElementById(ids.btnEscolher);
  const btnTirar = document.getElementById(ids.btnTirar);
  const btnTirarEnv = document.getElementById(ids.btnTirarEnv);
  const btnCapturar = document.getElementById(ids.btnCapturar);
  const preview = document.getElementById(ids.preview);
  const cameraArea = document.getElementById(ids.area);
  const videoEl = document.getElementById(ids.video);

  const fechar = () => {
    stopCameraStream(state.stream, videoEl, cameraArea);
    state.stream = null;
  };

  const showFilePreview = (file) => {
    if (!preview || !file) return;
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${url}" alt="Preview" class="clientes-foto-preview-img">`;
    preview.classList.remove("hidden");
    if (btnFoto) btnFoto.textContent = "Trocar arquivo";
  };

  const applyPastedFile = (file) => {
    if (!file) return;
    state.dataUrl = null;
    state.blob = file;
    fechar();
    showFilePreview(file);
    toast("Foto colada no cadastro.");
  };

  const onPaste = (e) => {
    if (e.defaultPrevented) return;
    const modal = document.getElementById("modal");
    if (!modal || modal.classList.contains("hidden")) return;
    const file = fileFromClipboardEvent(e);
    if (!file) return;
    e.preventDefault();
    applyPastedFile(file);
  };

  document.addEventListener("paste", onPaste);

  const fecharTudo = () => {
    document.removeEventListener("paste", onPaste);
    fechar();
  };

  if (btnFoto && photoInput) {
    btnFoto.addEventListener("click", () => photoInput.click());
    photoInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      state.dataUrl = null;
      state.blob = null;
      fechar();
      if (!file) {
        if (preview) {
          preview.innerHTML = "";
          preview.classList.add("hidden");
        }
        if (btnFoto) btnFoto.textContent = "Escolher arquivo";
        return;
      }
      showFilePreview(file);
    });
  }

  const onCameraFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    state.dataUrl = null;
    state.blob = file;
    fechar();
    showFilePreview(file);
  };
  cameraFile?.addEventListener("change", onCameraFile);
  cameraFileEnv?.addEventListener("change", onCameraFile);

  const abrirCamera = async (facing) => {
    const native = facing === "environment" ? cameraFileEnv : cameraFile;
    if (isTouchCameraDevice() && native) {
      native.click();
      return;
    }
    if (!videoEl || !cameraArea) {
      native?.click();
      return;
    }
    try {
      fechar();
      cameraArea.classList.remove("hidden");
      document.querySelector(".clientes-foto-wrap")?.classList.remove("is-capturing");
      if (preview) preview.innerHTML = "";
      if (photoInput) photoInput.value = "";
      state.stream = await startCadastroCamera(videoEl, cameraArea, facing);
      requestAnimationFrame(() => btnCapturar?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } catch (err) {
      console.warn("[Cadastro] Câmera:", err);
      if (native) {
        native.click();
        return;
      }
      toast("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
  };
  btnTirar?.addEventListener("click", () => abrirCamera("user"));
  btnTirarEnv?.addEventListener("click", () => abrirCamera("environment"));

  if (btnCapturar) {
    btnCapturar.addEventListener("click", () => {
      const video = document.getElementById(ids.video);
      if (!video || !video.videoWidth) {
        toast("Aguarde a câmera aparecer e tente de novo.");
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      state.dataUrl = dataUrl;
      const blobSync = dataUrlToBlobSync(dataUrl);
      if (blobSync?.size) state.blob = blobSync;
      if (preview) {
        preview.innerHTML = "";
        const img = document.createElement("img");
        img.alt = "Preview";
        img.className = "clientes-foto-preview-img";
        img.src = dataUrl;
        preview.appendChild(img);
        preview.classList.remove("hidden");
      }
      document.querySelector(".clientes-foto-wrap")?.classList.add("is-capturing");
      fechar();
      if (btnFoto) btnFoto.textContent = "Trocar arquivo";
    });
  }

  const wrap = document.querySelector(".clientes-foto-wrap");
  if (wrap) {
    wrap.setAttribute("tabindex", "0");
    wrap.addEventListener("paste", (e) => {
      const file = fileFromClipboardEvent(e);
      if (!file) return;
      e.preventDefault();
      applyPastedFile(file);
    });
  }

  return { fechar: fecharTudo };
}

export async function photoFileFromCadastro(ids, state) {
  const fromInput = document.getElementById(ids.file)?.files?.[0];
  const fromCameraInput = document.getElementById(ids.cameraFile)?.files?.[0];
  const fromCameraEnv = document.getElementById(ids.cameraFileEnv)?.files?.[0];
  if (fromCameraInput) return fromCameraInput;
  if (fromCameraEnv) return fromCameraEnv;
  if (fromInput) return fromInput;
  if (state.blob && state.blob.size > 0) {
    return state.blob instanceof File
      ? state.blob
      : new File([state.blob], "avatar.jpg", { type: state.blob.type || "image/jpeg" });
  }
  if (state.dataUrl) {
    const blob = dataUrlToBlobSync(state.dataUrl);
    if (blob?.size) return new File([blob], "avatar.jpg", { type: "image/jpeg" });
  }
  const previewImg = document.getElementById(ids.preview)?.querySelector("img");
  if (previewImg?.src?.startsWith("data:")) {
    const blob = dataUrlToBlobSync(previewImg.src);
    if (blob?.size) return new File([blob], "avatar.jpg", { type: "image/jpeg" });
  }
  return null;
}
