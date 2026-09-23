import { toast } from "../ui/toast.js";
import { sendWhatsapp } from "../services/whatsapp.service.js";
import { getAniversariantes, getClientes } from "../services/clientes.service.js";
import { listInactiveClients, listLoyaltyClients, getRadarRetorno } from "../services/crm.service.js";
import { buildCrmFila, filaWhatsappTemplate } from "../utils/crm-fila.js";
import { navigate } from "../core/spa.js";
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

const RADAR_LABEL = {
  pacote: "Pacote",
  nova_sem_2: "Sem 2º",
  atrasada: "Atrasada",
  sem_proxima: "Sem próxima",
  inativa: "Inativa",
};

export async function init() {
  const diasEl = document.getElementById("crmDiasInativo");
  const btnInativos = document.getElementById("crmBtnInativos");
  const listaInativos = document.getElementById("crmListaInativos");
  const listaFidel = document.getElementById("crmListaFidelidade");
  const listaAniv = document.getElementById("crmListaAniversario");
  const listaEspera = document.getElementById("crmListaEspera");
  const formEspera = document.getElementById("crmFormEspera");
  const listaRadar = document.getElementById("crmListaRadar");
  const listaFila = document.getElementById("crmListaFila");

  let radarFilter = "todos";
  let radarRows = [];
  let esperaRows = [];
  let fidelRows = [];
  let anivRows = [];

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
          return `<div class="crm-row">
            <div><strong>${escapeHtml(c.name)}</strong><br><span class="view-hint">${c.visits ? `${c.visits} visita(s) · última ${fmtDate(c.lastDate)}` : "Ainda não agendou"} · ${c.idleDays} dia(s) · WhatsApp na fila acima</span></div>
            ${c.id ? `<button type="button" class="btn-secondary btn-sm crm-agendar" data-id="${escapeHtml(c.id)}">Agendar</button>` : ""}
          </div>`;
        })
        .join("");
    } catch (err) {
      listaInativos.innerHTML = `<p class="view-hint">${escapeHtml(err.message || "Erro ao listar inativos.")}</p>`;
    }
  }

  function agendarUrl() {
    const orgId = profile.id || getActiveOrg() || "";
    return `${window.location.origin}/agendar.html?org=${encodeURIComponent(orgId)}`;
  }

  function renderFila() {
    if (!listaFila) return;
    const chunks = [];
    for (const c of radarRows) {
      chunks.push({
        clientId: c.id,
        name: c.name,
        phone: c.phone,
        sinal: c.sinal,
        motivo: c.motivo,
      });
    }
    for (const r of esperaRows) {
      chunks.push({
        clientId: r.client_id || null,
        name: r.nome,
        phone: r.phone,
        sinal: "espera",
        motivo: r.procedure_name ? `Espera: ${r.procedure_name}` : "Lista de espera",
      });
    }
    for (const c of fidelRows) {
      if (c.falta > 1) continue;
      chunks.push({
        clientId: c.id,
        name: c.name,
        phone: c.phone,
        sinal: "fidelidade",
        motivo: c.falta === 0 ? `Cortesia da ${c.meta}ª visita` : `Falta ${c.falta} para a cortesia`,
      });
    }
    for (const c of anivRows) {
      chunks.push({
        clientId: c.id,
        name: c.name,
        phone: c.phone,
        sinal: "aniversario",
        motivo: c._quando || "Aniversário nesta semana",
      });
    }
    const fila = buildCrmFila(chunks);
    if (!fila.length) {
      listaFila.innerHTML = "<p class=\"view-hint\">Fila vazia. WhatsApp só aqui (máx. 15) e no Avisar da espera — um clique por pessoa.</p>";
      return;
    }
    const clinic = clinicName(profile);
    const url = agendarUrl();
    listaFila.innerHTML = fila
      .map((c) => {
        const tel = digitsPhone(c.phone);
        const extra = c.sinal === "fidelidade" ? String(c.motivo || "") : "";
        const msg = filaWhatsappTemplate({ name: c.name, sinal: c.sinal, clinic, agendarUrl: url, extra });
        const tag = RADAR_LABEL[c.sinal] || (c.sinal === "espera" ? "Espera" : c.sinal === "fidelidade" ? "Fidelidade" : c.sinal === "aniversario" ? "Aniversário" : c.sinal);
        return `<div class="crm-row">
            <div><strong>${escapeHtml(c.name)}</strong> <span class="crm-radar-tag">${escapeHtml(tag)}</span><br>
            <span class="view-hint">${escapeHtml(c.motivo || "")}</span></div>
            <div class="crm-row-actions">
              ${c.clientId ? `<button type="button" class="btn-secondary btn-sm crm-agendar" data-id="${escapeHtml(c.clientId)}">Agendar</button>` : ""}
              ${tel.length >= 10 ? `<button type="button" class="btn-secondary btn-sm crm-wa" data-origem="crm_fila" data-sinal="${escapeHtml(c.sinal || "")}" data-phone="${escapeHtml(c.phone)}" data-msg="${escapeHtml(msg)}">WhatsApp</button>` : "<span class=\"view-hint\">Sem telefone</span>"}
            </div>
          </div>`;
      })
      .join("");
  }

  function renderRadar() {
    if (!listaRadar) return;
    const rows = radarFilter === "todos" ? radarRows : radarRows.filter((r) => r.sinal === radarFilter);
    if (!rows.length) {
      listaRadar.innerHTML = "<p class=\"view-hint\">Ninguém neste recorte. Bom sinal — ou ainda falta histórico na agenda.</p>";
      return;
    }
    listaRadar.innerHTML = rows
      .slice(0, 80)
      .map((c) => {
        const tag = RADAR_LABEL[c.sinal] || c.sinal;
        return `<div class="crm-row">
            <div><strong>${escapeHtml(c.name)}</strong> <span class="crm-radar-tag">${escapeHtml(tag)}</span><br>
            <span class="view-hint">${escapeHtml(c.motivo)} · WhatsApp na fila acima</span></div>
            <div class="crm-row-actions">
              <button type="button" class="btn-secondary btn-sm crm-agendar" data-id="${c.id}">Agendar</button>
            </div>
          </div>`;
      })
      .join("");
  }

  async function loadRadar() {
    if (!listaRadar) return;
    listaRadar.innerHTML = "<p class=\"view-hint\">Carregando radar…</p>";
    try {
      const dias = Math.max(21, Number(diasEl?.value) || 60);
      radarRows = await getRadarRetorno({ minDaysInativa: dias });
      renderRadar();
      renderFila();
    } catch (err) {
      listaRadar.innerHTML = `<p class="view-hint">${escapeHtml(err.message || "Erro no radar.")}</p>`;
    }
  }

  async function loadFidelidade() {
    if (!listaFidel) return;
    try {
      const rows = await listLoyaltyClients(meta);
      fidelRows = rows;
      if (!rows.length) {
        listaFidel.innerHTML = `<p class="view-hint">Ninguém perto da ${meta}ª visita ainda. A meta se configura em Empresa.</p>`;
        renderFila();
        return;
      }
      listaFidel.innerHTML = rows
        .map((c) => {
          const cortesia = c.falta === 0;
          return `<div class="crm-row">
            <div><strong>${escapeHtml(c.name)}</strong><br><span class="view-hint">${c.visits} visita(s)${cortesia ? " · cortesia agora" : ` · faltam ${c.falta}`} · WhatsApp na fila se faltar 0–1 visita</span></div>
          </div>`;
        })
        .join("");
      renderFila();
    } catch (err) {
      listaFidel.innerHTML = `<p class="view-hint">${escapeHtml(err.message || "Erro na fidelidade.")}</p>`;
    }
  }

  async function loadAniversario() {
    if (!listaAniv) return;
    try {
      const rows = await getAniversariantes("semana");
      anivRows = rows;
      if (!rows.length) {
        listaAniv.innerHTML = "<p class=\"view-hint\">Nenhum aniversário nesta semana (precisa ter data de nascimento no cadastro).</p>";
        renderFila();
        return;
      }
      listaAniv.innerHTML = rows
        .map((c) => {
          return `<div class="crm-row">
            <div><strong>${escapeHtml(c.name)}</strong><br><span class="view-hint">${escapeHtml(c._quando)} · WhatsApp na fila acima</span></div>
          </div>`;
        })
        .join("");
      renderFila();
    } catch (err) {
      listaAniv.innerHTML = `<p class="view-hint">${escapeHtml(err.message || "Erro nos aniversários.")}</p>`;
    }
  }

  async function loadEspera() {
    if (!listaEspera) return;
    try {
      const rows = await listWaitlist("aberta");
      esperaRows = rows;
      if (!rows.length) {
        listaEspera.innerHTML = "<p class=\"view-hint\">Lista vazia. Quando lotar, coloque a pessoa aqui e avise no WhatsApp quando abrir vaga.</p>";
        renderFila();
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
      renderFila();
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
      await sendWhatsapp(wa.dataset.phone, wa.dataset.msg, {
        origem: wa.dataset.origem || "crm",
        sinal: wa.dataset.sinal || "",
      });
      toast("WhatsApp aberto. Uma pessoa por clique — o sistema não dispara a fila sozinho.");
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
      return;
    }
    const agendar = e.target.closest?.(".crm-agendar");
    if (agendar?.dataset.id) {
      sessionStorage.setItem("agendaPrefillClientId", agendar.dataset.id);
      navigate("agenda");
      toast("Abra o horário: o cliente já vem selecionado. O sistema não envia mensagem sozinho.");
    }
  });

  document.querySelectorAll(".crm-radar-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      radarFilter = btn.dataset.radar || "todos";
      document.querySelectorAll(".crm-radar-chip").forEach((b) => b.classList.toggle("is-active", b === btn));
      renderRadar();
    });
  });

  btnInativos?.addEventListener("click", () => {
    loadInativos();
    loadRadar();
  });

  document.getElementById("crmBtnReviewLote")?.addEventListener("click", async () => {
    if (!reviewUrl) {
      toast("Cole o link do Google em Empresa e salve.");
      return;
    }
    try {
      const fila = buildCrmFila([
        ...radarRows.map((c) => ({ clientId: c.id, name: c.name, phone: c.phone, sinal: c.sinal })),
        ...esperaRows.map((r) => ({ clientId: r.client_id, name: r.nome, phone: r.phone, sinal: "espera" })),
        ...fidelRows.map((c) => ({ clientId: c.id, name: c.name, phone: c.phone, sinal: "fidelidade" })),
      ]);
      const withPhone = fila.filter((c) => digitsPhone(c.phone).length >= 10).slice(0, 1);
      if (!withPhone.length) {
        toast("Ninguém com telefone na fila. Use o WhatsApp na linha da pessoa.");
        return;
      }
      const c = withPhone[0];
      await sendWhatsapp(
        c.phone,
        `Oi, ${c.name}! Obrigada pela visita. Se puder, deixa uma avaliação no Google: ${reviewUrl}`,
        { origem: "crm_fila", sinal: "avaliacao" }
      );
      toast("Pedido de avaliação aberto para a primeira pessoa da fila. O resto é um clique por linha.");
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

  await Promise.all([loadRadar(), loadInativos(), loadFidelidade(), loadAniversario(), loadEspera()]);
}
