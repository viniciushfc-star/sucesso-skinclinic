import { toast } from "../ui/toast.js";
import { sendWhatsapp } from "../services/whatsapp.service.js";
import { getAniversariantes, getClientes } from "../services/clientes.service.js";
import { listInactiveClients, listLoyaltyClients } from "../services/crm.service.js";
import { addWaitlistEntry, listWaitlist, updateWaitlistStatus } from "../services/waitlist.service.js";
import { getOrganizationProfile } from "../services/organization-profile.service.js";
import { getActiveOrg } from "../core/org.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function digitsPhone(p) {
  return String(p ?? "").replace(/\D/g, "");
}

function fmtDate(iso) {
  if (!iso) return "nunca";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!d) return iso;
  return `${d}/${m}/${y}`;
}

function clinicName(profile) {
  return profile?.name || "nossa clínica";
}

export async function init() {
  const diasEl = document.getElementById("crmDiasInativo");
  const btnInativos = document.getElementById("crmBtnInativos");
  const listaInativos = document.getElementById("crmListaInativos");
  const listaFidel = document.getElementById("crmListaFidelidade");
  const listaAniv = document.getElementById("crmListaAniversario");
  const listaEspera = document.getElementById("crmListaEspera");
  const formEspera = document.getElementById("crmFormEspera");

  let profile = {};
  try {
    profile = (await getOrganizationProfile()) || {};
  } catch (_) {}
  const reviewUrl = (profile.google_review_url || "").trim();
  const meta = Number(profile.fidelidade_visitas) > 0 ? Number(profile.fidelidade_visitas) : 10;
  const reviewHint = document.getElementById("crmReviewUrlHint");
  if (reviewHint) {
    reviewHint.textContent = reviewUrl
      ? `Link de avaliação: ${reviewUrl}`
      : "Cadastre o link do Google em Empresa para pedir avaliação com um toque.";
  }

  async function loadInativos() {
    if (!listaInativos) return;
    listaInativos.innerHTML = "<p class=\"view-hint\">Carregando…</p>";
    try {
      const dias = Math.max(21, Number(diasEl?.value) || 60);
      const rows = await listInactiveClients(dias);
      if (!rows.length) {
        listaInativos.innerHTML = `<p class="view-hint">Ninguém parado há ${dias} dias ou mais.</p>`;
        return;
      }
      listaInativos.innerHTML = rows
        .slice(0, 80)
        .map((c) => {
          const tel = digitsPhone(c.phone);
          const orgId = profile.id || getActiveOrg() || "";
          const msg = `Oi, ${c.name || ""}! Faz um tempo que você não vem na ${clinicName(profile)}. Quer que eu encaixe um horário? ${window.location.origin}/agendar.html?org=${encodeURIComponent(orgId)}`;
          return `<div class="crm-row">
            <div><strong>${escapeHtml(c.name)}</strong><br><span class="view-hint">${c.visits ? `${c.visits} visita(s) · última ${fmtDate(c.lastDate)}` : "Ainda não agendou"} · ${c.idleDays} dia(s)</span></div>
            ${tel.length >= 10 ? `<button type="button" class="btn-secondary btn-sm crm-wa" data-phone="${escapeHtml(c.phone)}" data-msg="${escapeHtml(msg)}">WhatsApp</button>` : "<span class=\"view-hint\">Sem telefone</span>"}
          </div>`;
        })
        .join("");
    } catch (err) {
      listaInativos.innerHTML = `<p class="view-hint">${escapeHtml(err.message || "Erro ao listar inativos.")}</p>`;
    }
  }

  async function loadFidelidade() {
    if (!listaFidel) return;
    try {
      const rows = await listLoyaltyClients(meta);
      if (!rows.length) {
        listaFidel.innerHTML = `<p class="view-hint">Ninguém perto da ${meta}ª visita ainda. A meta se configura em Empresa.</p>`;
        return;
      }
      listaFidel.innerHTML = rows
        .map((c) => {
          const tel = digitsPhone(c.phone);
          const cortesia = c.falta === 0;
          const msg = cortesia
            ? `Oi, ${c.name}! Você completou ${c.visits} visitas na ${clinicName(profile)}. A próxima tem cortesia combinada. Quer agendar?`
            : `Oi, ${c.name}! Falta ${c.falta} visita(s) para a cortesia da ${c.meta}ª. Te encaixo?`;
          const review = reviewUrl
            ? ` Oi! Se puder, avalia a gente no Google: ${reviewUrl}`
            : "";
          return `<div class="crm-row">
            <div><strong>${escapeHtml(c.name)}</strong><br><span class="view-hint">${c.visits} visita(s)${cortesia ? " · cortesia agora" : ` · faltam ${c.falta}`}</span></div>
            ${tel.length >= 10 ? `<button type="button" class="btn-secondary btn-sm crm-wa" data-phone="${escapeHtml(c.phone)}" data-msg="${escapeHtml(msg + (cortesia && reviewUrl ? review : ""))}">WhatsApp</button>` : ""}
          </div>`;
        })
        .join("");
    } catch (err) {
      listaFidel.innerHTML = `<p class="view-hint">${escapeHtml(err.message || "Erro na fidelidade.")}</p>`;
    }
  }

  async function loadAniversario() {
    if (!listaAniv) return;
    try {
      const rows = await getAniversariantes("semana");
      if (!rows.length) {
        listaAniv.innerHTML = "<p class=\"view-hint\">Nenhum aniversário nesta semana (precisa ter data de nascimento no cadastro).</p>";
        return;
      }
      const brinde = profile.brinde_aniversario_habilitado
        ? " Trouxemos um brinde para você nesta visita."
        : "";
      listaAniv.innerHTML = rows
        .map((c) => {
          const msg = `Feliz aniversário, ${c.name}! ${brinde} Quer comemorar com um horário na ${clinicName(profile)}?`;
          const tel = digitsPhone(c.phone);
          return `<div class="crm-row">
            <div><strong>${escapeHtml(c.name)}</strong><br><span class="view-hint">${escapeHtml(c._quando)}</span></div>
            ${tel.length >= 10 ? `<button type="button" class="btn-secondary btn-sm crm-wa" data-phone="${escapeHtml(c.phone)}" data-msg="${escapeHtml(msg)}">WhatsApp</button>` : ""}
          </div>`;
        })
        .join("");
    } catch (err) {
      listaAniv.innerHTML = `<p class="view-hint">${escapeHtml(err.message || "Erro nos aniversários.")}</p>`;
    }
  }

  async function loadEspera() {
    if (!listaEspera) return;
    try {
      const rows = await listWaitlist("aberta");
      if (!rows.length) {
        listaEspera.innerHTML = "<p class=\"view-hint\">Lista vazia. Quando lotar, coloque a pessoa aqui e avise no WhatsApp quando abrir vaga.</p>";
        return;
      }
      listaEspera.innerHTML = rows
        .map((r) => {
          const tel = digitsPhone(r.phone);
          const msg = `Oi, ${r.nome}! Abriu um horário na ${clinicName(profile)}${r.procedure_name ? ` para ${r.procedure_name}` : ""}. Ainda quer?`;
          return `<div class="crm-row">
            <div><strong>${escapeHtml(r.nome)}</strong><br><span class="view-hint">${escapeHtml(r.procedure_name || "procedimento livre")} · ${r.preferred_date ? fmtDate(r.preferred_date) : "qualquer dia"}</span></div>
            <div class="crm-row-actions">
              ${tel.length >= 10 ? `<button type="button" class="btn-secondary btn-sm crm-wa" data-phone="${escapeHtml(r.phone)}" data-msg="${escapeHtml(msg)}">Avisar</button>` : ""}
              <button type="button" class="btn-sm crm-wait-done" data-id="${r.id}">Encaixei</button>
            </div>
          </div>`;
        })
        .join("");
    } catch (err) {
      const msg = String(err.message || err.details || "");
      listaEspera.innerHTML = msg.toLowerCase().includes("agenda_waitlist") || msg.toLowerCase().includes("does not exist")
        ? "<p class=\"view-hint\">Rode o SQL <code>supabase-crm-waitlist.sql</code> no Supabase para ativar a lista de espera.</p>"
        : `<p class="view-hint">${escapeHtml(msg || "Erro na lista de espera.")}</p>`;
    }
  }

  document.getElementById("crmRoot")?.addEventListener("click", async (e) => {
    const wa = e.target.closest?.(".crm-wa");
    if (wa) {
      await sendWhatsapp(wa.dataset.phone, wa.dataset.msg);
      toast("WhatsApp aberto. Se a API estiver ligada, a mensagem já saiu.");
      return;
    }
    const done = e.target.closest?.(".crm-wait-done");
    if (done?.dataset.id) {
      try {
        await updateWaitlistStatus(done.dataset.id, "encaixada");
        toast("Marcado como encaixado.");
        await loadEspera();
      } catch (err) {
        toast(err.message || "Não foi possível atualizar.");
      }
    }
  });

  btnInativos?.addEventListener("click", loadInativos);

  document.getElementById("crmBtnReviewLote")?.addEventListener("click", async () => {
    if (!reviewUrl) {
      toast("Cole o link do Google em Empresa e salve.");
      return;
    }
    try {
      const rows = await listLoyaltyClients(Math.max(2, meta - 5));
      const withPhone = rows.filter((c) => digitsPhone(c.phone).length >= 10).slice(0, 1);
      if (!withPhone.length) {
        toast("Ninguém com telefone e visitas recentes para o primeiro pedido. Use o botão no fim da baixa da agenda.");
        return;
      }
      const c = withPhone[0];
      await sendWhatsapp(
        c.phone,
        `Oi, ${c.name}! Obrigada pela visita. Se puder, deixa uma avaliação no Google: ${reviewUrl}`
      );
      toast("Pedido de avaliação aberto para a primeira cliente da lista. Repita nas outras pelo WhatsApp de cada linha.");
    } catch (err) {
      toast(err.message || "Não foi possível montar o pedido.");
    }
  });

  formEspera?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("crmEsperaNome")?.value?.trim();
    const phone = document.getElementById("crmEsperaPhone")?.value?.trim();
    const procedure_name = document.getElementById("crmEsperaProc")?.value?.trim();
    const preferred_date = document.getElementById("crmEsperaData")?.value || null;
    const clientSelect = document.getElementById("crmEsperaCliente");
    try {
      await addWaitlistEntry({
        nome: nome || clientSelect?.selectedOptions?.[0]?.text || "",
        phone,
        procedure_name,
        preferred_date,
        client_id: clientSelect?.value || null,
      });
      formEspera.reset();
      toast("Entrou na lista de espera.");
      await loadEspera();
    } catch (err) {
      toast(err.message || "Não salvou a espera. Confira se o SQL foi rodado.");
    }
  });

  const sel = document.getElementById("crmEsperaCliente");
  if (sel) {
    try {
      const clients = await getClientes();
      sel.innerHTML =
        `<option value="">Cliente avulso (preencha o nome)</option>` +
        clients
          .slice(0, 400)
          .map((c) => `<option value="${c.id}" data-phone="${escapeHtml(c.phone || "")}">${escapeHtml(c.name)}</option>`)
          .join("");
      sel.addEventListener("change", () => {
        const opt = sel.selectedOptions[0];
        const nomeEl = document.getElementById("crmEsperaNome");
        const phoneEl = document.getElementById("crmEsperaPhone");
        if (opt?.value && nomeEl && !nomeEl.value) nomeEl.value = opt.textContent || "";
        if (opt?.dataset.phone && phoneEl && !phoneEl.value) phoneEl.value = opt.dataset.phone;
      });
    } catch (_) {}
  }

  await Promise.all([loadInativos(), loadFidelidade(), loadAniversario(), loadEspera()]);
}
