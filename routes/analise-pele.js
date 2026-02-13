/**
 * Análise de Pele por IA (MVP) — API
 * Recebe token, consentimento, imagens (base64), respostas.
 * Chama IA com prompt canônico (linguagem "pode estar relacionado a..."); salva via RPC submit_analise_pele.
 * Não diagnostica; profissional valida depois.
 */

import { createClient } from "@supabase/supabase-js";
import { askAI, COMPLEXITY } from "../ai/core/index.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BUCKET = "analise-pele-fotos";

const PROMPT_CANON = `
Você é uma camada de organização e explicação para pré-anamnese de pele, inspirada no uso responsável de IA em clínicas. Você NÃO é dermatologista virtual, NÃO diagnostica, NÃO prescreve, NÃO promete resultado.

REGRAS OBRIGATÓRIAS:
- Use SEMPRE linguagem como: "pode estar relacionado a…", "costuma aparecer quando…", "vale investigar com um profissional…".
- NUNCA use termos definitivos nem feche diagnóstico.
- Imagem é entrada para contexto; relacione o que observa com as respostas do cliente.
- Tom: educativo, calmo, responsável, humano, sem alarme.

FRASES-GUIA (respeite):
- "Imagem sem contexto não é análise."
- "A IA organiza, o profissional valida."
- "Análise prepara o cuidado, não substitui o encontro."

Respostas do cliente (contexto humano):
${"{{RESPOSTAS}}"}

Com base nas imagens e nas respostas acima, produza um texto em português, em parágrafos curtos, que:
1) Organize os pontos de atenção visuais que você observa (sem diagnosticar).
2) Relacione com o que o cliente disse (queixa, o que já tentou, como se sente).
3) Sugira o que "vale investigar com um profissional" e o que "pode estar relacionado a".
4) Termine com: "Essa análise será validada por um profissional." E depois: "Esta análise existe para aproximar pessoas do cuidado profissional, mesmo à distância."
5) Inclua, se fizer sentido: "Você pode refazer a análise quando quiser (por exemplo, após um tratamento) para acompanhar mudanças."

Retorne APENAS o texto da análise, sem título extra nem JSON.
`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { token, consentimento_imagens, menor_responsavel, imagens, respostas } = req.body || {};

    if (!token || !consentimento_imagens) {
      return res.status(400).json({
        error: "Token e consentimento para uso das imagens são obrigatórios.",
      });
    }

    const { data: session, error: sessionError } = await supabase.rpc(
      "get_client_session_by_token",
      { p_token: token }
    );
    if (sessionError || !session?.length) {
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }
    const { client_id, org_id } = session[0];
    if (!client_id || !org_id) {
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }

    const arrImages = Array.isArray(imagens) ? imagens : [];
    const respostasObj = respostas && typeof respostas === "object" ? respostas : {};
    const promptText = PROMPT_CANON.replace(
      "{{RESPOSTAS}}",
      JSON.stringify(respostasObj, null, 2)
    );

    let ia_preliminar = "";
    if (arrImages.length > 0 && process.env.OPENAI_KEY) {
      const content = [
        { type: "text", text: promptText },
        ...arrImages.slice(0, 5).map((img) => {
          const url = typeof img === "string" && img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`;
          return { type: "image_url", image_url: { url } };
        }),
      ];
      const { content: reply } = await askAI({
        userId: null,
        orgId: org_id,
        feature: "analise-pele",
        messages: [{ role: "user", content }],
        complexity: COMPLEXITY.RARE,
        checks: {},
        outputType: "analysis",
        systemInstruction: "",
        skipCache: true,
        extraCreateOptions: { max_tokens: 600 },
      });
      ia_preliminar = (reply || "").trim();
    } else {
      ia_preliminar =
        "Não foi possível gerar análise visual desta vez. Suas respostas foram registradas e um profissional poderá entrar em contato para validar e complementar.";
    }

    let imagensUrls = [];
    try {
      const pathPrefix = `${org_id}/${client_id}/${Date.now()}`;
      for (let i = 0; i < arrImages.length; i++) {
        const img = arrImages[i];
        let base64 = typeof img === "string" ? img : "";
        if (base64.startsWith("data:")) {
          base64 = base64.replace(/^data:image\/\w+;base64,/, "");
        }
        if (!base64) continue;
        const buf = Buffer.from(base64, "base64");
        const path = `${pathPrefix}/foto_${i}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, buf, { contentType: "image/jpeg", upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
          imagensUrls.push(urlData?.publicUrl || path);
        }
      }
    } catch (storageErr) {
      console.warn("[ANALISE-PELE] Storage upload failed (bucket pode não existir):", storageErr.message);
    }

    const { data: insertResult, error: insertError } = await supabase.rpc(
      "submit_analise_pele",
      {
        p_token: token,
        p_consentimento_imagens: true,
        p_menor_responsavel: menor_responsavel || null,
        p_imagens: imagensUrls,
        p_respostas: respostasObj,
        p_ia_preliminar: ia_preliminar,
      }
    );

    if (insertError) {
      console.error("[ANALISE-PELE] RPC submit_analise_pele:", insertError);
      return res.status(500).json({
        error: insertError.message || "Erro ao salvar a análise. Tente novamente.",
      });
    }

    const id = insertResult?.id;

    return res.status(200).json({
      id,
      ia_preliminar,
      message: "Análise registrada. Um profissional validará e você receberá o retorno em breve.",
    });
  } catch (err) {
    console.error("[ANALISE-PELE]", err);
    return res.status(500).json({
      error: err.message || "Erro ao processar a análise. Tente novamente.",
    });
  }
}

