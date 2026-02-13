/**
 * Cadastro da empresa — perfil da organização.
 * Inclui quantidade de salas e tipos de procedimento por sala (para agendamento sem gargalo).
 */

import { getOrganizationProfile, updateOrganizationProfile, uploadOrgLogo } from "../services/organization-profile.service.js";
import { listSalas, createSala, updateSala } from "../services/salas.service.js";
import { buscarCep, maskCepInput, fillAddressFields } from "../utils/cep.service.js";
import { toast } from "../ui/toast.js";
import { getActiveOrg } from "../core/org.js";
import { openModal, closeModal } from "../ui/modal.js";
import { TIPOS_PROCEDIMENTO } from "../constants/tipos-procedimento.js";

export async function init() {
  const orgId = getActiveOrg();
  if (!orgId) {
    toast("Selecione uma organização");
    return;
  }

  const form = document.getElementById("empresaForm");
  const nome = document.getElementById("empresaNome");
  const cidade = document.getElementById("empresaCidade");
  const estado = document.getElementById("empresaEstado");
  const logoUrl = document.getElementById("empresaLogoUrl");
  const endereco = document.getElementById("empresaEndereco");
  const empresaCep = document.getElementById("empresaCep");
  const empresaComplemento = document.getElementById("empresaComplemento");
  const cnpj = document.getElementById("empresaCnpj");
  const telefone = document.getElementById("empresaTelefone");
  const btnSalvar = document.getElementById("empresaBtnSalvar");
  const empresaSalasCount = document.getElementById("empresaSalasCount");
  const empresaBtnGerenciarSalas = document.getElementById("empresaBtnGerenciarSalas");
  const empresaBtnNovaSala = document.getElementById("empresaBtnNovaSala");
  const empresaSalasLista = document.getElementById("empresaSalasLista");
  const empresaLogoFile = document.getElementById("empresaLogoFile");
  const empresaLogoPreview = document.getElementById("empresaLogoPreview");
  const empresaResumo = document.getElementById("empresaResumo");
  const empresaResumoContent = document.getElementById("empresaResumo")?.querySelector(".empresa-resumo-content");
  const empresaBtnEditar = document.getElementById("empresaBtnEditar");

  if (!form || !btnSalvar) return;

  function getProfileForResumo() {
    return {
      name: nome?.value?.trim() || "",
      cidade: cidade?.value?.trim() || "",
      estado: estado?.value?.trim() || "",
      logo_url: logoUrl?.value?.trim() || "",
      endereco: endereco?.value?.trim() || "",
      cep: empresaCep?.value?.trim() || "",
      complemento: empresaComplemento?.value?.trim() || "",
      cnpj: cnpj?.value?.trim() || "",
      telefone: telefone?.value?.trim() || "",
      menu_anamnese_visible: empresaMenuAnamnese?.checked ?? false,
      brinde_aniversario_habilitado: empresaBrindeAniversario?.checked ?? false,
      nota_fiscal_emitir_url: empresaNotaFiscalEmitirUrl?.value?.trim() || ""
    };
  }

  function renderResumo(p) {
    if (!empresaResumoContent) return;
    const linha = (label, val) => val ? `<p class="empresa-resumo-line"><strong>${escapeHtml(label)}</strong> ${escapeHtml(val)}</p>` : "";
    empresaResumoContent.innerHTML = `
      <div class="empresa-resumo-card">
        <h3 class="empresa-resumo-card-title">Identidade</h3>
        ${p.logo_url ? `<div class="empresa-resumo-logo"><img src="${escapeHtml(p.logo_url)}" alt="Logo"></div>` : ""}
        ${linha("Nome", p.name)}
        ${linha("Cidade / Estado", [p.cidade, p.estado].filter(Boolean).join(" — "))}
        ${linha("Telefone", p.telefone)}
      </div>
      <div class="empresa-resumo-card">
        <h3 class="empresa-resumo-card-title">Endereço e dados fiscais</h3>
        ${linha("CEP", p.cep)}
        ${linha("Endereço", p.endereco)}
        ${linha("Complemento", p.complemento)}
        ${linha("CNPJ", p.cnpj)}
        ${linha("Link para emitir nota fiscal", p.nota_fiscal_emitir_url || "—")}
      </div>
      <div class="empresa-resumo-card">
        <h3 class="empresa-resumo-card-title">Preferências</h3>
        <p class="empresa-resumo-line"><strong>Anamnese no menu</strong> ${p.menu_anamnese_visible ? "Sim" : "Não"}</p>
        <p class="empresa-resumo-line"><strong>Brinde aniversário</strong> ${p.brinde_aniversario_habilitado ? "Sim" : "Não"}</p>
      </div>`;
  }

  function showResumo() {
    const p = getProfileForResumo();
    renderResumo(p);
    if (form) form.classList.add("hidden");
    if (empresaResumo) empresaResumo.classList.remove("hidden");
  }

  function showForm() {
    if (empresaResumo) empresaResumo.classList.add("hidden");
    if (form) form.classList.remove("hidden");
  }

  if (empresaBtnEditar) {
    empresaBtnEditar.addEventListener("click", () => showForm());
  }

  let logoFile = null;
  if (empresaLogoFile && empresaLogoPreview) {
    empresaLogoFile.addEventListener("change", () => {
      const file = empresaLogoFile.files?.[0] || null;
      logoFile = file;
      empresaLogoPreview.innerHTML = "";
      if (file) {
        const url = URL.createObjectURL(file);
        const img = document.createElement("img");
        img.src = url;
        img.alt = "Pré-visualização do logo";
        img.className = "empresa-logo-preview-img";
        empresaLogoPreview.appendChild(img);
      }
    });
  }

  function maskTelefone(el) {
    if (!el) return;
    let v = el.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length <= 2) {
      el.value = v.length ? "(" + v : "";
      return;
    }
    v = "(" + v.slice(0, 2) + ") " + v.slice(2);
    if (v.length > 10) v = v.slice(0, 10) + "-" + v.slice(10);
    el.value = v;
  }
  function maskCnpj(el) {
    if (!el) return;
    let v = el.value.replace(/\D/g, "");
    if (v.length > 14) v = v.slice(0, 14);
    v = v.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
    el.value = v;
  }
  if (telefone) {
    telefone.addEventListener("input", () => maskTelefone(telefone));
    telefone.addEventListener("blur", () => maskTelefone(telefone));
  }
  if (cnpj) {
    cnpj.addEventListener("input", () => maskCnpj(cnpj));
    cnpj.addEventListener("blur", () => maskCnpj(cnpj));
  }

  async function executarBuscaCep(overwrite = false, showToasts = true) {
    const raw = empresaCep?.value?.replace(/\D/g, "") || "";
    if (raw.length !== 8) {
      if (showToasts) toast("Informe um CEP válido (8 dígitos).");
      return;
    }
    try {
      if (showToasts) toast("Buscando CEP…");
      const result = await buscarCep(raw);
      if (!result) {
        if (showToasts) toast("CEP não encontrado.");
        return;
      }
      fillAddressFields(result, { cidade, estado, endereco }, overwrite);
      if (showToasts) toast("Endereço preenchido.");
    } catch (_) {
      if (showToasts) toast("Erro ao buscar CEP. Tente novamente.");
    }
  }

  if (empresaCep) {
    empresaCep.addEventListener("input", () => maskCepInput(empresaCep));
    empresaCep.addEventListener("blur", () => maskCepInput(empresaCep));
    empresaCep.addEventListener("blur", () => executarBuscaCep(false, false));
  }
  const empresaCepBuscar = document.getElementById("empresaCepBuscar");
  if (empresaCepBuscar) {
    empresaCepBuscar.addEventListener("click", () => executarBuscaCep(true, true));
  }

  const empresaMenuAnamnese = document.getElementById("empresaMenuAnamnese");
  const empresaBrindeAniversario = document.getElementById("empresaBrindeAniversario");
  const empresaNotaFiscalEmitirUrl = document.getElementById("empresaNotaFiscalEmitirUrl");

  try {
    const profile = await getOrganizationProfile();
    if (nome) nome.value = profile.name || "";
    if (cidade) cidade.value = profile.cidade || "";
    if (estado) estado.value = profile.estado || "";
    if (logoUrl) logoUrl.value = profile.logo_url || "";
    if (endereco) endereco.value = profile.endereco || "";
    if (empresaCep) empresaCep.value = profile.cep || "";
    if (empresaComplemento) empresaComplemento.value = profile.complemento || "";
    if (cnpj) { cnpj.value = profile.cnpj || ""; maskCnpj(cnpj); }
    if (telefone) { telefone.value = profile.telefone || ""; maskTelefone(telefone); }
    if (empresaMenuAnamnese) empresaMenuAnamnese.checked = !!profile.menu_anamnese_visible;
    if (empresaBrindeAniversario) empresaBrindeAniversario.checked = !!profile.brinde_aniversario_habilitado;
    if (empresaNotaFiscalEmitirUrl) empresaNotaFiscalEmitirUrl.value = profile.nota_fiscal_emitir_url || "";
    if (profile.logo_url && empresaLogoPreview) {
      empresaLogoPreview.innerHTML = `<img src="${escapeHtml(profile.logo_url)}" alt="Logo atual" class="empresa-logo-preview-img">`;
    }
    if (profile.name && profile.name.trim()) {
      showResumo();
    } else {
      showForm();
    }
  } catch (e) {
    console.error("[EMPRESA] erro carregar", e);
    toast("Erro ao carregar cadastro da empresa");
    showForm();
  }

  async function refreshSalasCount() {
    try {
      const salas = await listSalas(true);
      if (empresaSalasCount) empresaSalasCount.textContent = `Salas: ${salas.length} cadastrada(s)`;
      if (empresaSalasLista) {
        empresaSalasLista.innerHTML = salas.length === 0
          ? "<p class=\"empresa-salas-empty\">Nenhuma sala cadastrada. Use o botão \"+ Nova sala\" acima para adicionar.</p>"
          : salas.map((s) => {
              const tipos = Array.isArray(s.procedimento_tipos) ? s.procedimento_tipos : [];
              const labelTipo = (t) => TIPOS_PROCEDIMENTO.find((x) => x.value === t)?.label || t;
              const chips = tipos.length ? tipos.map((t) => `<span class="empresa-sala-chip">${escapeHtml(labelTipo(t))}</span>`).join("") : "<span class=\"empresa-sala-chip empresa-sala-chip-empty\">Nenhum tipo</span>";
              return `<div class="empresa-sala-card" data-id="${escapeHtml(s.id)}">
                <div class="empresa-sala-card-body">
                  <h4 class="empresa-sala-card-nome">${escapeHtml(s.nome || "Sala")}</h4>
                  <p class="empresa-sala-card-tipos-label">Procedimentos:</p>
                  <div class="empresa-sala-chips">${chips}</div>
                </div>
                <button type="button" class="empresa-sala-btn-editar btn-edit-sala" data-id="${escapeHtml(s.id)}" title="Editar esta sala">Editar</button>
              </div>`;
            }).join("");
        empresaSalasLista.querySelectorAll(".btn-edit-sala").forEach((btn) => {
          btn.addEventListener("click", () => openSalaModal(btn.dataset.id));
        });
      }
      return true;
    } catch (e) {
      console.warn("[EMPRESA] listSalas", e);
      if (empresaSalasCount) empresaSalasCount.textContent = "Salas: erro ao carregar";
      if (empresaSalasLista) {
        empresaSalasLista.innerHTML = "<p class=\"empresa-salas-error\">Não foi possível carregar as salas. Verifique se a tabela <code>salas</code> existe no Supabase e se as políticas RLS permitem leitura. Use \"+ Nova sala\" acima para cadastrar mesmo assim.</p>";
      }
      toast("Erro ao carregar salas. Verifique o console.");
      return false;
    }
  }
  await refreshSalasCount();

  if (empresaBtnNovaSala) {
    empresaBtnNovaSala.addEventListener("click", () => openSalaModal());
  }
  if (empresaBtnGerenciarSalas) {
    empresaBtnGerenciarSalas.addEventListener("click", () => {
      refreshSalasCount();
      if (empresaSalasLista) empresaSalasLista.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function openSalaModal(salaId = null) {
    const isEdit = !!salaId;
    const checkboxesHtml = TIPOS_PROCEDIMENTO.map((t) => `
      <label class="sala-tipo-chip">
        <input type="checkbox" name="salaTipo" value="${escapeHtml(t.value)}">
        <span class="sala-tipo-chip-label">${escapeHtml(t.label)}</span>
      </label>`).join("");
    openModal(
      isEdit ? "Editar sala" : "Nova sala",
      `
      <label>Nome da sala/cabine</label>
      <input type="text" id="salaNome" placeholder="Ex.: Sala 1, Cabine Facial" required>
      <label>Descrição (opcional)</label>
      <input type="text" id="salaDescricao" placeholder="Ex.: Equipamento X">
      <p class="sala-tipos-label">Que tipos de procedimento esta sala atende?</p>
      <p class="sala-tipos-sublabel">Marque todos que se aplicam. Na agenda só aparecem salas compatíveis com o procedimento.</p>
      <div class="sala-tipos-grid">${checkboxesHtml}</div>
      `,
      async () => {
        const nomeEl = document.getElementById("salaNome");
        const descEl = document.getElementById("salaDescricao");
        const checked = Array.from(document.querySelectorAll("input[name=salaTipo]:checked")).map((c) => c.value);
        if (!nomeEl?.value?.trim()) {
          toast("Nome da sala é obrigatório");
          return;
        }
        try {
          if (isEdit) {
            await updateSala(salaId, { nome: nomeEl.value.trim(), descricao: descEl?.value?.trim() || null, procedimento_tipos: checked });
            toast("Sala atualizada.");
          } else {
            await createSala({ nome: nomeEl.value.trim(), descricao: descEl?.value?.trim() || null, procedimento_tipos: checked });
            toast("Sala cadastrada.");
          }
          closeModal();
          await refreshSalasCount();
        } catch (e) {
          toast(e.message || "Erro ao salvar sala");
        }
      }
    );
    if (isEdit) {
      (async () => {
        const salas = await listSalas(true);
        const s = salas.find((x) => x.id === salaId);
        if (s) {
          const nomeEl = document.getElementById("salaNome");
          const descEl = document.getElementById("salaDescricao");
          if (nomeEl) nomeEl.value = s.nome || "";
          if (descEl) descEl.value = s.descricao || "";
          const tipos = s.procedimento_tipos || [];
          document.querySelectorAll("input[name=salaTipo]").forEach((cb) => {
            cb.checked = tipos.includes(cb.value);
          });
        }
      })();
    }
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!btnSalvar) return;
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando…";
    try {
      // Se houver um arquivo de logo selecionado, faz upload antes de salvar o perfil
      if (logoFile) {
        try {
          const publicUrl = await uploadOrgLogo(logoFile);
          if (publicUrl && logoUrl) {
            logoUrl.value = publicUrl;
          }
        } catch (errUpload) {
          console.warn("[EMPRESA] Upload logo falhou", errUpload);
          toast("Não foi possível enviar o logo. Verifique o arquivo ou tente novamente.");
        }
      }

      const menuAnamnese = empresaMenuAnamnese?.checked ?? false;
      const brindeAniversario = empresaBrindeAniversario?.checked ?? false;
      await updateOrganizationProfile({
        name: nome?.value?.trim(),
        cidade: cidade?.value?.trim(),
        estado: estado?.value?.trim(),
        logo_url: logoUrl?.value?.trim(),
        endereco: endereco?.value?.trim(),
        cep: empresaCep?.value?.trim() || null,
        complemento: empresaComplemento?.value?.trim() || null,
        cnpj: cnpj?.value?.trim(),
        telefone: telefone?.value?.trim(),
        menu_anamnese_visible: menuAnamnese,
        brinde_aniversario_habilitado: brindeAniversario,
        nota_fiscal_emitir_url: empresaNotaFiscalEmitirUrl?.value?.trim() || null
      });
      toast("Cadastro da empresa atualizado.");
      const menuWrap = document.getElementById("menuWrapAnamnese");
      if (menuWrap) menuWrap.classList.toggle("menu-item-hidden", !menuAnamnese);
      btnSalvar.textContent = "Salvar";
      showResumo();
    } catch (err) {
      console.error("[EMPRESA] erro salvar", err);
      toast(err.message || "Erro ao salvar");
      btnSalvar.textContent = "Salvar";
    } finally {
      btnSalvar.disabled = false;
    }
  });
}

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
