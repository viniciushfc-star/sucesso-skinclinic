/**
 * CEP e foto do cadastro da pessoa (não da ficha clínica).
 */
import { buscarCep, maskCepInput, fillAddressFields } from "./cep.service.js";

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

export async function startCadastroCamera(videoEl, areaEl) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("no-api");
  }
  if (areaEl) areaEl.classList.remove("hidden");
  const tries = [
    { video: { facingMode: { ideal: "user" } } },
    { video: true },
  ];
  let lastErr;
  for (const constraints of tries) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoEl.srcObject = stream;
      videoEl.setAttribute("playsinline", "true");
      videoEl.muted = true;
      await videoEl.play().catch(() => {});
      await waitVideoReady(videoEl);
      return stream;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("camera");
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
      <div class="clientes-foto-buttons">
        <button type="button" class="clientes-foto-btn" id="${ids.btnEscolher}">Escolher arquivo</button>
        <button type="button" class="clientes-foto-btn clientes-foto-btn-camera" id="${ids.btnTirar}">Tirar foto</button>
      </div>
      <div class="clientes-camera-area hidden" id="${ids.area}">
        <video id="${ids.video}" class="clientes-camera-video" autoplay playsinline muted></video>
        <button type="button" class="clientes-foto-btn clientes-foto-btn-capture" id="${ids.btnCapturar}">Capturar foto</button>
      </div>
      <div class="clientes-foto-preview" id="${ids.preview}">${preview}</div>
      <p class="form-hint">Cole uma foto do WhatsApp com Ctrl+V (ou Cmd+V). No celular, use “Tirar foto”.</p>
    </div>
  `;
}

export function captureIds(prefix) {
  return {
    file: `${prefix}Photo`,
    cameraFile: `${prefix}PhotoCamera`,
    btnEscolher: `${prefix}BtnEscolherFoto`,
    btnTirar: `${prefix}BtnTirarFoto`,
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
  const btnFoto = document.getElementById(ids.btnEscolher);
  const btnTirar = document.getElementById(ids.btnTirar);
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

  if (cameraFile) {
    cameraFile.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      state.dataUrl = null;
      state.blob = file;
      fechar();
      showFilePreview(file);
    });
  }

  if (btnTirar) {
    btnTirar.addEventListener("click", async () => {
      if (isTouchCameraDevice() && cameraFile) {
        cameraFile.click();
        return;
      }
      if (!videoEl || !cameraArea) {
        if (cameraFile) cameraFile.click();
        return;
      }
      try {
        fechar();
        cameraArea.classList.remove("hidden");
        document.querySelector(".clientes-foto-wrap")?.classList.remove("is-capturing");
        if (preview) preview.innerHTML = "";
        if (photoInput) photoInput.value = "";
        state.stream = await startCadastroCamera(videoEl, cameraArea);
        requestAnimationFrame(() => btnCapturar?.scrollIntoView({ behavior: "smooth", block: "center" }));
      } catch (err) {
        console.warn("[Cadastro] Câmera:", err);
        if (cameraFile) {
          cameraFile.click();
          return;
        }
        toast("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
      }
    });
  }

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
  if (fromCameraInput) return fromCameraInput;
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
