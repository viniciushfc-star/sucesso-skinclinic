/**
 * Portal: página para o cliente assinar apenas o termo de consentimento.
 * Acessada via link com ?token=xxx&mode=consent (enviado pela clínica).
 * Registra nome por extenso para respaldo.
 */
import { getClientByToken, signConsentOnly } from "./client-portal.service.js";
import { toast } from "./ui/toast.client.js";

const app = document.getElementById("app");

function escapeHtml(s) {
  if (!s) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export async function init() {
  const token =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("client_portal_token")
      : null;

  if (!token) {
    app.innerHTML = "<p>Link inválido ou expirado. Solicite um novo à clínica.</p>";
    return;
  }

  try {
    app.innerHTML = "<p>Carregando...</p>";
    const client = await getClientByToken(token);
    if (!client) {
      app.innerHTML = "<p>Link inválido ou expirado.</p>";
      return;
    }

    app.innerHTML = `
    <section class="client-completar-cadastro">
      <h2>Termo de consentimento</h2>
      <p class="client-hint">A clínica solicitou que você assine o termo de consentimento. Informe seu nome completo como no documento e aceite os termos abaixo.</p>
      <form id="formTermoConsent">
        <label>Nome completo por extenso (como no documento) <span class="required">*</span></label>
        <input type="text" id="termoSignedName" required placeholder="Ex.: Maria da Silva Santos" autocomplete="name" value="${escapeHtml(client.name || "")}">
        <div class="client-termo-wrap">
          <h3 class="client-termo-title">Termo de consentimento</h3>
          <div class="client-termo-texto" tabindex="0">
            <p><strong>1. Prestação de serviços</strong> — Declaro que contratei os serviços da clínica de forma voluntária; que a relação é de prestação de serviços e que os profissionais que realizam os procedimentos atuam em nome da clínica. Recebi informações sobre procedimentos, riscos e cuidados. Comprometo-me a informar meu histórico de saúde e a seguir as orientações pós-procedimento.</p>
            <p><strong>2. Direito de imagem</strong> — Autorizo o uso das minhas imagens (fotos de procedimento, antes/depois) para acompanhamento do tratamento e prontuário. Abaixo posso autorizar também o uso para divulgação institucional (redes sociais, site), com anuência prévia minha para cada publicação.</p>
            <p><strong>3. Dados pessoais e demais cláusulas</strong> — O termo completo (uso de dados pessoais/LGPD, responsabilidade, foro) está à disposição na clínica. Ao aceitar, confirmo que li e aceito o termo na íntegra.</p>
          </div>
          <label class="client-termo-check">
            <input type="checkbox" id="termoConsentAccept" required>
            Li e aceito o Termo de Consentimento e Prestação de Serviços.
          </label>
          <label class="client-termo-check">
            <input type="checkbox" id="termoConsentImageUse">
            Autorizo a clínica a usar minhas imagens para divulgação institucional (com anuência prévia para cada uso).
          </label>
        </div>
        <button type="submit" class="btn-primary">Assinar termo</button>
      </form>
    </section>`;

    document.getElementById("formTermoConsent").addEventListener("submit", async (e) => {
      e.preventDefault();
      const signedName = document.getElementById("termoSignedName")?.value?.trim();
      const accept = document.getElementById("termoConsentAccept")?.checked ?? false;
      const imageUse = document.getElementById("termoConsentImageUse")?.checked ?? false;

      if (!signedName || signedName.length < 3) {
        toast("Informe seu nome completo por extenso.");
        return;
      }
      if (!accept) {
        toast("É obrigatório aceitar o termo.");
        return;
      }

      const btn = e.target.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Enviando...";
      }

      try {
        await signConsentOnly(token, {
          signed_name: signedName,
          consent_image_use: imageUse,
          consent_terms_version: "v1",
        });
        toast("Termo assinado com sucesso!");
        app.innerHTML = `
          <section class="client-header">
            <h2>Termo assinado</h2>
            <p>Obrigado! Sua assinatura foi registrada. A clínica foi notificada.</p>
          </section>`;
      } catch (err) {
        console.error(err);
        toast(err?.message || "Erro ao enviar");
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Assinar termo";
        }
      }
    });
  } catch (err) {
    console.error("[Termo consent]", err);
    app.innerHTML = "<p>Erro ao carregar. Tente novamente.</p>";
    toast(err?.message || "Erro");
  }
}
