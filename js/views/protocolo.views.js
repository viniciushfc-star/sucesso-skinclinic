import { gerarProtocolo } from "../services/protocolo.service.js";
import { supabase } from "../core/supabase.js";
import { toast } from "../ui/toast.js";

const btnGerarProtocolo = document.getElementById("btnGerarProtocolo");
const resultadoProtocolo = document.getElementById("resultadoProtocolo");
const protocoloAnaliseEl = document.getElementById("protocoloAnalise");
const protocoloIdadeEl = document.getElementById("protocoloIdade");
const protocoloFototipoEl = document.getElementById("protocoloFototipo");
const resultadoPele = document.getElementById("resultado");

function parseAnaliseInput() {
  const fromView = (protocoloAnaliseEl?.value?.trim() || resultadoPele?.innerText?.trim() || "");
  if (!fromView) return {};
  try {
    return JSON.parse(fromView);
  } catch {
    return { texto: fromView };
  }
}

if (btnGerarProtocolo && resultadoProtocolo) {
  btnGerarProtocolo.onclick = async () => {
    const analise = parseAnaliseInput();
    const payload = {
      analise,
      dados: {
        idade: protocoloIdadeEl?.value?.trim() || "",
        fototipo: protocoloFototipoEl?.value?.trim() || ""
      }
    };

    resultadoProtocolo.innerText = "Gerando...";

    try {
      const res = await gerarProtocolo(payload);
      const raw = res?.content ?? res?.message ?? (typeof res === "string" ? res : null);
      const content = typeof raw === "string" ? raw : (raw ? JSON.stringify(raw, null, 2) : JSON.stringify(res, null, 2));
      resultadoProtocolo.innerText = content || "Sem resposta.";

      const { data: { user } } = await supabase.auth.getUser();
      const idAnalise = sessionStorage.getItem("protocolo_analise_id") || null;
      if (user?.id && res) {
        await supabase.from("protocolos_ia").insert({
          analise_id: idAnalise,
          user_id: user.id,
          protocolo: res
        }).then(({ error }) => {
          if (error) console.warn("Não foi possível salvar em protocolos_ia:", error);
        });
      }
    } catch (err) {
      console.error(err);
      resultadoProtocolo.innerText = "Erro: " + (err?.message || "não foi possível gerar.");
      toast(err?.message || "Erro ao gerar protocolo", "error");
    }
  };
}
