import { perguntarCopiloto } from "../services/copiloto.service.js";
import { toast } from "../ui/toast.js";
import { userFacingError } from "../core/errors.js";

function mostrarFonte(el, fonte) {
  if (!el) return;
  const f = String(fonte || "").trim();
  if (!f) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = `Fonte: ${f}`;
}

export async function init() {
  const btn = document.getElementById("btnPerguntar");
  const pergunta = document.getElementById("pergunta");
  const resposta = document.getElementById("resposta");
  const fonteEl = document.getElementById("respostaFonte");
  if (!btn || !pergunta || !resposta) return;

  btn.onclick = async () => {
    const q = String(pergunta.value || "").trim();
    if (!q) {
      toast("Escreva uma pergunta.");
      return;
    }
    resposta.textContent = "Consultando os dados da clínica…";
    mostrarFonte(fonteEl, "");
    btn.disabled = true;
    try {
      const res = await perguntarCopiloto({ pergunta: q });
      resposta.textContent = res?.resposta || "Sem resposta.";
      mostrarFonte(fonteEl, res?.fonte);
    } catch (err) {
      console.error("[COPILOTO]", err);
      const msg = userFacingError(err, "Não foi possível consultar a Consultora agora.");
      resposta.textContent = msg;
      mostrarFonte(fonteEl, "");
      toast(msg, "error");
    } finally {
      btn.disabled = false;
    }
  };
}
