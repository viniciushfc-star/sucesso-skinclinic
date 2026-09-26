import { perguntarCopiloto } from "../services/copiloto.service.js";
import { toast } from "../ui/toast.js";

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
      resposta.textContent = "Erro ao consultar a Consultora.";
      mostrarFonte(fonteEl, "");
      toast("Erro ao consultar IA");
    } finally {
      btn.disabled = false;
    }
  };
}
