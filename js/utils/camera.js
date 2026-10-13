/**
 * Câmera: vídeo ao vivo + botão Capturar.
 * facing: "user" (frontal) ou "environment" (traseira). Sempre tenta a outra se a pedida falhar.
 */
let currentStream = null;

function stopStream() {
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
}

function waitVideoReady(video, ms = 10000) {
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

export function otherCameraFacing(facing) {
  return facing === "user" ? "environment" : "user";
}

export async function getCameraStream(facing) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("no-api");
  }
  const preferred = facing === "environment" ? "environment" : facing === "user" ? "user" : null;
  const tries = [];
  if (preferred) {
    tries.push({ video: { facingMode: { ideal: preferred } } });
    tries.push({ video: { facingMode: { ideal: otherCameraFacing(preferred) } } });
  } else {
    tries.push({ video: { facingMode: { ideal: "user" } } });
    tries.push({ video: { facingMode: { ideal: "environment" } } });
  }
  tries.push({ video: true });
  let lastErr;
  for (const constraints of tries) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("camera");
}

export function startCameraCapture(previewIdOrEl, onBlob, toast = (msg) => console.warn(msg), opts = {}) {
  const getPreview = () =>
    typeof previewIdOrEl === "string" ? document.getElementById(previewIdOrEl) : previewIdOrEl;

  let facing = opts.facing === "environment" ? "environment" : "user";

  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Câmera não disponível neste navegador.");
    return stopStream;
  }

  const mount = async (nextFacing) => {
    facing = nextFacing === "environment" ? "environment" : "user";
    stopStream();
    const stream = await getCameraStream(facing);
    currentStream = stream;
    const previewEl = getPreview();
    if (!previewEl) {
      stopStream();
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "clientes-camera-wrapper";
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.setAttribute("playsinline", "true");
    video.srcObject = stream;
    video.className = "clientes-camera-video";
    const actions = document.createElement("div");
    actions.className = "clientes-foto-buttons";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "clientes-foto-btn clientes-foto-btn-capture";
    btn.textContent = "Capturar foto";
    const flip = document.createElement("button");
    flip.type = "button";
    flip.className = "clientes-foto-btn clientes-foto-btn-camera";
    flip.textContent = facing === "user" ? "Usar traseira" : "Usar frontal";
    actions.appendChild(btn);
    actions.appendChild(flip);
    wrapper.appendChild(video);
    wrapper.appendChild(actions);
    previewEl.innerHTML = "";
    previewEl.classList.add("clientes-camera-active");
    previewEl.appendChild(wrapper);

    await video.play().catch(() => {});
    await waitVideoReady(video).catch(() => {});

    flip.addEventListener("click", () => {
      mount(otherCameraFacing(facing)).catch((err) => {
        console.warn("[Câmera]", err);
        toast("Não foi possível trocar a câmera.");
      });
    });

    btn.addEventListener("click", () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
        toast("Aguarde a câmera carregar.");
        return;
      }
      btn.disabled = true;
      btn.textContent = "Capturando...";

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);

      stopStream();
      previewEl.classList.remove("clientes-camera-active");

      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          onBlob(blob);
          const el = getPreview();
          if (!el) return;
          el.innerHTML = "";
          const img = document.createElement("img");
          img.alt = "Preview";
          img.className = "clientes-foto-preview-img";
          img.src = URL.createObjectURL(blob);
          el.appendChild(img);
        },
        "image/jpeg",
        0.9
      );
    });
  };

  mount(facing).catch((err) => {
    console.warn("[Câmera]", err);
    toast("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
  });

  return stopStream;
}
