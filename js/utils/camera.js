/**
 * Câmera: vídeo ao vivo + botão Capturar.
 * Ao capturar: para o vídeo, gera o blob e no callback mostra a imagem congelada e chama onBlob(blob).
 * Retorna uma função stop() para desligar a câmera ao fechar o modal (evita câmera ficar ligada).
 */
let currentStream = null;

function stopStream() {
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
}

export function startCameraCapture(previewIdOrEl, onBlob, toast = (msg) => console.warn(msg)) {
  const getPreview = () =>
    typeof previewIdOrEl === "string" ? document.getElementById(previewIdOrEl) : previewIdOrEl;

  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Câmera não disponível neste navegador.");
    return stopStream;
  }

  const constraints = {
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
  };

  navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => {
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
      video.srcObject = stream;
      video.className = "clientes-camera-video";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "clientes-foto-btn clientes-foto-btn-capture";
      btn.textContent = "Capturar foto";
      wrapper.appendChild(video);
      wrapper.appendChild(btn);
      previewEl.innerHTML = "";
      previewEl.classList.add("clientes-camera-active");
      previewEl.appendChild(wrapper);

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
    })
    .catch((err) => {
      console.warn("[Câmera]", err);
      toast("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    });

  return stopStream;
}
