import {
  getClientByToken,
  completeRegistration,
} from "./client-portal.service.js";
import { toast } from "./ui/toast.client.js";

const app = document.getElementById("app");

function escapeHtml(s) {
  if (!s) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function formatDateInput(iso) {
  if (!iso) return "";
  try {
    return String(iso).slice(0, 10);
  } catch {
    return "";
  }
}

function formatCpfDisplay(cpf) {
  if (!cpf || typeof cpf !== "string") return "";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function maskCpfInput(input) {
  if (!input) return;
  let v = input.value.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);
  input.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) => (a ? a + (b ? "." + b : "") + (c ? "." + c : "") + (d ? "-" + d : "") : ""));
}

function updateTermoResumo() {
  const name = document.getElementById("regName")?.value?.trim() || "";
  const cpfRaw = document.getElementById("regCpf")?.value?.replace(/\D/g, "") || "";
  const cpf = cpfRaw.length === 11 ? formatCpfDisplay(cpfRaw) : (document.getElementById("regCpf")?.value?.trim() || "");
  const phone = document.getElementById("regPhone")?.value?.trim() || "";
  const email = document.getElementById("regEmail")?.value?.trim() || "";
  const contato = phone || email || "(preencha telefone ou e-mail)";
  const el = document.getElementById("termoResumo");
  if (el) {
    el.textContent = name
      ? `Você está aceitando o termo como: ${name}${cpf ? ", CPF " + cpf : ""}, contato: ${contato}. Confira se os dados estão corretos.`
      : "Preencha nome e contato acima; o aceite será registrado com esses dados.";
  }
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
    if (client.registration_completed_at) {
      app.innerHTML = `
        <section class="client-header">
          <h2>Cadastro completo</h2>
          <p>Você já completou seu cadastro. Obrigado!</p>
          <p><a href="#dashboard">Ir para o painel</a></p>
        </section>`;
      return;
    }

    renderForm(client);
  } catch (err) {
    console.error("[Completar cadastro]", err);
    app.innerHTML = "<p>Erro ao carregar. Tente novamente.</p>";
    toast(err?.message || "Erro");
  }
}

function renderForm(client) {
  app.innerHTML = `
    <section class="client-completar-cadastro">
      <h2>Complete seu cadastro</h2>
      <p class="client-hint">Preencha seus dados para que a clínica possa acompanhar seu tratamento.</p>
      <form id="formCompletarCadastro">
        <label>Nome completo <span class="required">*</span></label>
        <input type="text" id="regName" required value="${escapeHtml(client.name || "")}" placeholder="Nome completo">
        <label>CPF (recomendado para o contrato)</label>
        <input type="text" id="regCpf" value="${escapeHtml(formatCpfDisplay(client.cpf || ""))}" placeholder="000.000.000-00" maxlength="14">
        <label>Telefone</label>
        <input type="tel" id="regPhone" value="${escapeHtml(client.phone || "")}" placeholder="(00) 00000-0000">
        <label>E-mail</label>
        <input type="email" id="regEmail" value="${escapeHtml(client.email || "")}" placeholder="email@exemplo.com">
        <p class="client-hint">Informe pelo menos telefone ou e-mail.</p>
        <label>Data de nascimento</label>
        <input type="date" id="regBirthDate" value="${formatDateInput(client.birth_date)}">
        <label>Sexo</label>
        <select id="regSex">
          <option value="">—</option>
          <option value="F" ${client.sex === "F" ? "selected" : ""}>Feminino</option>
          <option value="M" ${client.sex === "M" ? "selected" : ""}>Masculino</option>
          <option value="Outro" ${client.sex === "Outro" ? "selected" : ""}>Outro</option>
        </select>
        <label>Observações (opcional)</label>
        <textarea id="regNotes" rows="2" placeholder="Alguma informação que a clínica deva saber">${escapeHtml(client.notes || "")}</textarea>

        <div class="client-termo-wrap">
          <h3 class="client-termo-title">Termo de consentimento</h3>
          <p id="termoResumo" class="client-termo-resumo" aria-live="polite"></p>
          <div class="client-termo-texto" tabindex="0">
            <p><strong>1. Prestação de serviços</strong> — Declaro que contratei os serviços da clínica de forma voluntária; que a relação é de prestação de serviços e que os profissionais que realizam os procedimentos atuam em nome da clínica. Recebi informações sobre procedimentos, riscos e cuidados. Comprometo-me a informar meu histórico de saúde e a seguir as orientações pós-procedimento.</p>
            <p><strong>2. Direito de imagem</strong> — Autorizo o uso das minhas imagens (fotos de procedimento, antes/depois) para acompanhamento do tratamento e prontuário. Abaixo posso autorizar também o uso para divulgação institucional (redes sociais, site), com anuência prévia minha para cada publicação.</p>
            <p><strong>3. Dados pessoais e demais cláusulas</strong> — O termo completo (uso de dados pessoais/LGPD, responsabilidade, foro) está à disposição na clínica. Ao aceitar, confirmo que li e aceito o termo na íntegra.</p>
          </div>
          <label class="client-termo-check">
            <input type="checkbox" id="regConsentTerms" required>
            Li e aceito o Termo de Consentimento e Prestação de Serviços (prestação de serviços, direito de imagem, dados pessoais e cláusulas disponíveis na clínica).
          </label>
          <label class="client-termo-check">
            <input type="checkbox" id="regConsentImageUse">
            Autorizo a clínica a usar minhas imagens para divulgação institucional (com anuência prévia para cada uso).
          </label>
        </div>

        <button type="submit" class="btn-primary">Enviar cadastro</button>
      </form>
    </section>`;

  ["regName", "regCpf", "regPhone", "regEmail"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateTermoResumo);
  });
  const regCpf = document.getElementById("regCpf");
  if (regCpf) regCpf.addEventListener("input", () => maskCpfInput(regCpf));
  updateTermoResumo();

  document.getElementById("formCompletarCadastro").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("regName")?.value?.trim();
    const cpfRaw = document.getElementById("regCpf")?.value?.replace(/\D/g, "") || null;
    const cpf = cpfRaw && cpfRaw.length === 11 ? cpfRaw : null;
    const phone = document.getElementById("regPhone")?.value?.trim() || null;
    const email = document.getElementById("regEmail")?.value?.trim() || null;
    const birth_date = document.getElementById("regBirthDate")?.value || null;
    const sex = document.getElementById("regSex")?.value || null;
    const notes = document.getElementById("regNotes")?.value?.trim() || null;

    if (!name) {
      toast("Nome é obrigatório");
      return;
    }
    if (!phone && !email) {
      toast("Informe telefone ou e-mail");
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Enviando...";
    }

    const consentTerms = document.getElementById("regConsentTerms")?.checked ?? false;
    const consentImageUse = document.getElementById("regConsentImageUse")?.checked ?? false;
    if (!consentTerms) {
      toast("É obrigatório aceitar o Termo de Consentimento.");
      return;
    }

    try {
      await completeRegistration(
        typeof sessionStorage !== "undefined" ? sessionStorage.getItem("client_portal_token") : null,
        {
          name,
          phone,
          email,
          birth_date: birth_date || null,
          sex,
          notes,
          cpf,
          consent_terms_accepted: true,
          consent_image_use: consentImageUse,
          consent_terms_version: "v1"
        }
      );
      toast("Cadastro enviado com sucesso!");
      app.innerHTML = `
        <section class="client-header">
          <h2>Cadastro completo</h2>
          <p>Obrigado! Seus dados foram salvos. A clínica já pode acompanhar seu tratamento.</p>
          <p><a href="#dashboard">Ir para o painel</a></p>
        </section>`;
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao enviar");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Enviar cadastro";
      }
    }
  });
}
