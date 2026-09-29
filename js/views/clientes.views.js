import {
  getClientes,
  getClientById,
  createClient,
  getClientByCpf,
  uploadClientPhoto,
  updateClient,
  createClientPortalSession,
  CLIENT_STATES,
} from "../services/clientes.service.js";
import { importarLote } from "../services/importacao-lote.service.js";
import { getActiveOrg } from "../core/org.js";
import { audit } from "../services/audit.service.js";
import { checkPermission } from "../core/permissions.js";
import { openModal, closeModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { navigate } from "../core/spa.js";
import { listOrcamentosForSearch } from "../services/orcamentos.service.js";
import { parseClientesBusca, relacaoComercialLabel } from "../utils/cliente-relacao.js";
import { brl, statusOrcamentoLabel, totalOrcamento } from "../utils/orcamento.js";
import {
  htmlEnderecoCliente,
  bindEnderecoCliente,
  readEnderecoCliente,
  htmlFotoCadastro,
  captureIds,
  wireFotoCadastro,
  photoFileFromCadastro,
} from "../utils/cliente-cadastro.js";

let ultimaBuscaAbreOrcamento = false;

let clientes = [];
let canEdit = false;
/** Stream da câmera (controlado pela view para fechar ao salvar/cancelar) */
let fotoCadastroState = { stream: null, blob: null, dataUrl: null };
let fotoCadastroIds = captureIds("client");
let fotoCadastroWire = null;

export async function init() {
  canEdit = (await Promise.all([
    checkPermission("clientes:manage"),
    checkPermission("clientes:edit"),
  ])).some(Boolean);
  await loadClientes();
  bindUI();
}

function bindImportClientes() {
  const btn = document.getElementById("btnImportarClientes");
  const input = document.getElementById("importClientesFile");
  if (!btn || !input) return;
  btn.onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    input.value = "";
    const pularDuplicados = document.getElementById("clientesPularDuplicados")?.checked !== false;
    try {
      const r = await importarLote("clientes", file, { pularDuplicados });
      let msg = r.inseridos ? r.inseridos + " cliente(s) importado(s)." : "Nenhum importado.";
      if (r.ignorados_duplicados > 0) msg += " " + r.ignorados_duplicados + " duplicado(s) ignorado(s).";
      toast(msg);
      if (r.erros?.length) toast("Erros: " + r.erros.length + " linha(s).", "warn");
      await loadClientes();
    } catch (e) {
      toast(e.message || "Erro ao importar.");
    }
  };
}

/* =========================
   LOAD
========================= */

async function loadClientes() {
  const rawSearch = document.getElementById("clientesSearch")?.value?.trim() || "";
  const parsed = parseClientesBusca(rawSearch);
  const state = document.getElementById("clientesFilterState")?.value || "";
  const relacaoFiltro = document.getElementById("clientesFilterRelacao")?.value || (!parsed.abrirOrcamento ? parsed.relacao : "") || "";
  ultimaBuscaAbreOrcamento = parsed.abrirOrcamento;

  try {
    clientes = await getClientes({
      search: parsed.texto || undefined,
      state: state || undefined,
      relacao_comercial: relacaoFiltro || undefined,
      limit: 250,
    });
    renderClientes();
    await renderBuscaOrcamentos(parsed);
  } catch (err) {
    console.error("[Clientes] loadClientes falhou:", err);
    clientes = [];
    renderClientes();
    const msg = err?.message || err?.error_description || String(err);
    toast(msg.includes("app.org_id") ? "Erro de permissão: rode o SQL supabase-rls-clients-fix.sql no Supabase" : "Erro ao carregar clientes");
  }
}

/* =========================
   RENDER
========================= */

function stateLabel(stateOrStatus) {
  if (!stateOrStatus) return "—";
  return CLIENT_STATES[stateOrStatus] || (stateOrStatus === "active" ? "Em acompanhamento" : stateOrStatus === "archived" ? "Arquivado" : stateOrStatus);
}

function renderClientes() {
  const tbody = document.getElementById("listaClientes");
  const emptyEl = document.getElementById("clientesEmpty");
  if (!tbody) return;

  if (!clientes.length) {
    tbody.innerHTML = "";
    if (emptyEl) {
      emptyEl.classList.remove("hidden");
      emptyEl.textContent = "Nenhum cliente encontrado.";
    }
    return;
  }

  if (emptyEl) emptyEl.classList.add("hidden");

  tbody.innerHTML = clientes
    .map(
      (c) => {
        const avatar = c.avatar_url
          ? `<img class="clientes-avatar" src="${String(c.avatar_url).replace(/"/g, "&quot;")}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling?.classList.remove('hidden')">`
          : "";
        const initials = (c.name || "")
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase() || "?";
        return `
    <tr class="clientes-row" data-id="${c.id}" role="button" tabindex="0">
      <td>
        <div class="clientes-row-name">
          <span class="clientes-avatar-wrap">
            ${avatar}
            <span class="clientes-avatar-initials ${avatar ? "hidden" : ""}">${escapeHtml(initials)}</span>
          </span>
          <strong>${escapeHtml(c.name || "")}</strong>
        </div>
      </td>
      <td><span class="clientes-relacao clientes-relacao-${escapeHtml(c.relacao_comercial || "none")}">${escapeHtml(relacaoComercialLabel(c.relacao_comercial))}</span></td>
      <td><span class="clientes-state clientes-state-${(c.state || c.status || "").replace("_", "-")}">${stateLabel(c.state || c.status)}</span></td>
      <td>${escapeHtml(c.phone || c.email || "—")}</td>
      <td>${formatDate(c.created_at)}</td>
      <td class="clientes-col-acoes">${canEdit ? `<button type="button" class="btn-secondary btn-sm btn-editar-cliente" data-id="${c.id}" title="Editar cliente">Editar</button>` : ""}</td>
    </tr>
  `;
      }
    )
    .join("");

  bindEditEvents();
}

function escapeHtml(s) {
  if (!s) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

/* =========================
   UI BINDINGS
========================= */

function bindUI() {
  const btnNovo = document.getElementById("btnNovoCliente");
  if (btnNovo) btnNovo.addEventListener("click", openCreateModal);

  const searchEl = document.getElementById("clientesSearch");
  if (searchEl) {
    searchEl.addEventListener("input", debounce(loadClientes, 300));
    searchEl.addEventListener("keydown", (e) => e.key === "Enter" && loadClientes());
  }

  const filterRelacao = document.getElementById("clientesFilterRelacao");
  if (filterRelacao) filterRelacao.addEventListener("change", loadClientes);

  const filterState = document.getElementById("clientesFilterState");
  if (filterState) filterState.addEventListener("change", loadClientes);

  bindImportClientes();

  const btnModelo = document.getElementById("btnModeloClientes");
  if (btnModelo) {
    btnModelo.onclick = (e) => {
      e.preventDefault();
      const headers = getTemplateHeaders("clientes");
      const line = headers.join(";");
      const blob = new Blob([line + "\n"], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "modelo_clientes.csv";
      a.click();
      toast("Modelo baixado!");
    };
  }
}

function bindEditEvents() {
  document.querySelectorAll(".clientes-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".btn-editar-cliente")) return;
      openPerfil(row.dataset.id);
    });
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPerfil(row.dataset.id);
      }
    });
  });
  document.querySelectorAll(".btn-editar-cliente").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!id) return;
      sessionStorage.setItem("clientePerfilId", id);
      sessionStorage.setItem("clientePerfilOpenEdit", "1");
      navigate("cliente-perfil");
    });
  });
}

function openPerfil(clientId, tab) {
  if (!clientId) return;
  sessionStorage.setItem("clientePerfilId", clientId);
  if (tab) sessionStorage.setItem("clientePerfilOpenTab", tab);
  else if (ultimaBuscaAbreOrcamento) sessionStorage.setItem("clientePerfilOpenTab", "orcamentos");
  navigate("cliente-perfil");
}

async function renderBuscaOrcamentos(parsed) {
  const box = document.getElementById("clientesBuscaOrcamentos");
  if (!box) return;
  if (!parsed?.abrirOrcamento) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  try {
    let rows = await listOrcamentosForSearch({ search: parsed.texto, limit: 40 });
    const byId = Object.fromEntries((clientes || []).map((c) => [c.id, c]));
    const missing = [...new Set(rows.map((r) => r.client_id).filter((id) => id && !byId[id]))];
    for (const id of missing.slice(0, 20)) {
      try {
        const c = await getClientById(id);
        byId[c.id] = c;
      } catch {
        /* ignore */
      }
    }
    if (parsed.texto) {
      const t = parsed.texto.toLowerCase();
      rows = rows.filter((r) => {
        const nome = String(byId[r.client_id]?.name || "").toLowerCase();
        return nome.includes(t) || (Array.isArray(r.items) && r.items.some((it) => String(it?.name || "").toLowerCase().includes(t)));
      });
    }
    if (!rows.length) {
      box.classList.remove("hidden");
      box.innerHTML = `<p class="clientes-busca-orcamentos-empty">Nenhum orçamento bate com essa busca. Cadastros abaixo seguem o filtro.</p>`;
      return;
    }
    box.classList.remove("hidden");
    box.innerHTML = `<p class="clientes-busca-orcamentos-title">Orçamentos — clique para abrir</p>
      <ul class="clientes-busca-orcamentos-list">
        ${rows.slice(0, 12).map((o) => {
          const nome = escapeHtml(byId[o.client_id]?.name || "Cliente");
          const itens = (Array.isArray(o.items) ? o.items : []).map((it) => it.name).filter(Boolean).slice(0, 2).join(", ");
          return `<li>
            <button type="button" class="clientes-busca-orcamento-btn" data-client="${escapeHtml(o.client_id)}" data-orcamento="${escapeHtml(o.id)}">
              <strong>${nome}</strong>
              <span>${escapeHtml(statusOrcamentoLabel(o.status))} · ${brl(totalOrcamento(o.items))}</span>
              <span>${escapeHtml(itens || "—")}</span>
            </button>
          </li>`;
        }).join("")}
      </ul>`;
    box.querySelectorAll(".clientes-busca-orcamento-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        sessionStorage.setItem("clientePerfilOrcamentoId", btn.dataset.orcamento || "");
        openPerfil(btn.dataset.client, "orcamentos");
      });
    });
  } catch {
    box.classList.add("hidden");
  }
}

function debounce(fn, ms) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

/** Converte data URL (base64) em Blob — versão síncrona para usar no momento da captura. */
function dataUrlToBlobSync(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const i = dataUrl.indexOf(",");
  if (i === -1) return null;
  const base64 = dataUrl.slice(i + 1);
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
    return new Blob([bytes], { type: "image/jpeg" });
  } catch (e) {
    return null;
  }
}

/** Converte data URL (base64) em Blob — versão assíncrona (Promise). */
function dataUrlToBlob(dataUrl) {
  return Promise.resolve(dataUrlToBlobSync(dataUrl));
}

/* =========================
   MODAL: ADICIONAR CLIENTE
========================= */

function maskCpf(input) {
  let v = input.value.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  input.value = v;
}

/** Máscara (00) 00000-0000 celular ou (00) 0000-0000 fixo */
function maskPhone(input) {
  let v = input.value.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 6) {
    if (v[2] === "9") v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
    else v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  } else if (v.length > 2) {
    v = v.replace(/(\d{2})(\d{0,4})/, "($1) $2");
  } else if (v.length) {
    v = "(" + v;
  }
  input.value = v;
}

/** Encerra o hardware: para cada track do MediaStream (limpa trilhos). Fechar o vídeo não desliga o LED da câmera. */
function fecharCamera() {
  fotoCadastroWire?.fechar?.();
  fotoCadastroState.stream = null;
}

function openCreateModal() {
  fotoCadastroState = { stream: null, blob: null, dataUrl: null };
  fotoCadastroIds = captureIds("client");

  openModal(
    "Adicionar cliente",
    `
    ${htmlFotoCadastro(fotoCadastroIds)}
    <label>Nome completo <span class="required">*</span></label>
    <input id="name" required placeholder="Nome completo">
    <label>CPF (evita duplicado)</label>
    <input id="cpf" type="text" placeholder="000.000.000-00" maxlength="14">
    <p id="cpfDuplicateWarning" class="form-warning hidden" role="alert"></p>
    <label>Telefone</label>
    <input id="phone" type="tel" placeholder="(00) 00000-0000" maxlength="15">
    <label>E-mail</label>
    <input id="email" type="email" placeholder="email@exemplo.com">
    <p class="form-hint">Informe pelo menos telefone ou e-mail.</p>
    ${htmlEnderecoCliente("client")}
    <label>Data de nascimento</label>
    <input id="birth_date" type="date">
    <label>Sexo</label>
    <select id="sex">
      <option value="">—</option>
      <option value="F">Feminino</option>
      <option value="M">Masculino</option>
      <option value="Outro">Outro</option>
    </select>
    <label>Observações iniciais</label>
    <textarea id="notes" rows="2" placeholder="Opcional"></textarea>
    <label>Relação comercial</label>
    <select id="relacaoComercial">
      <option value="">Não definido</option>
      <option value="orcamento">Só orçamento</option>
      <option value="comprou">Comprou</option>
      <option value="revenda">Revenda da clínica</option>
    </select>
    <label>Estado inicial</label>
    <select id="state">
      <option value="em_acompanhamento">Em acompanhamento</option>
      <option value="pre_cadastro">Pré-cadastro</option>
    </select>
    <label class="form-check"><input type="checkbox" id="agendarAposCadastro"> Após salvar, abrir a agenda com esta pessoa</label>
  `,
    createCliente,
    fecharCamera
  );
  const cpfInput = document.getElementById("cpf");
  const cpfWarning = document.getElementById("cpfDuplicateWarning");
  if (cpfInput) {
    cpfInput.addEventListener("input", () => {
      maskCpf(cpfInput);
      if (cpfWarning) {
        cpfWarning.classList.add("hidden");
        cpfWarning.textContent = "";
      }
    });
    cpfInput.addEventListener("blur", async () => {
      const raw = cpfInput.value.replace(/\D/g, "");
      if (raw.length !== 11 || !cpfWarning) return;
      try {
        const existing = await getClientByCpf(raw);
        if (existing) {
          cpfWarning.textContent = "Já existe um cliente com este CPF: " + (existing.name || "cliente cadastrado") + ". Evite cadastrar de novo.";
          cpfWarning.classList.remove("hidden");
        } else {
          cpfWarning.classList.add("hidden");
          cpfWarning.textContent = "";
        }
      } catch (e) {
        console.warn("[Clientes] Verificação CPF:", e);
      }
    });
  }
  const phoneInput = document.getElementById("phone");
  if (phoneInput) phoneInput.addEventListener("input", () => maskPhone(phoneInput));
  bindEnderecoCliente("client", toast);
  fotoCadastroWire = wireFotoCadastro(fotoCadastroIds, fotoCadastroState, toast);
}

async function createCliente() {
  const name = document.getElementById("name")?.value?.trim();
  const cpf = document.getElementById("cpf")?.value?.trim() || null;
  const phone = document.getElementById("phone")?.value?.trim() || null;
  const email = document.getElementById("email")?.value?.trim() || null;
  const birth_date = document.getElementById("birth_date")?.value || null;
  const sex = document.getElementById("sex")?.value || null;
  const notes = document.getElementById("notes")?.value?.trim() || null;
  const state = document.getElementById("state")?.value || "em_acompanhamento";
  const relacao_comercial = document.getElementById("relacaoComercial")?.value || "";
  const endereco = readEnderecoCliente("client");
  const photoFile = await photoFileFromCadastro(fotoCadastroIds, fotoCadastroState);
  fecharCamera();

  if (!name) {
    toast("Nome é obrigatório");
    return;
  }
  if (!phone && !email) {
    toast("Informe telefone ou e-mail");
    return;
  }

  try {
    const client = await createClient({
      name,
      cpf: cpf || undefined,
      phone,
      email,
      birth_date: birth_date || undefined,
      sex: sex || undefined,
      notes: notes || undefined,
      state,
      relacao_comercial: relacao_comercial || undefined,
      ...endereco,
    });

    let avatarUrlForList = null;
    if (photoFile && client?.id) {
      const orgId = getActiveOrg();
      if (orgId) {
        try {
          const uploaded = await uploadClientPhoto(orgId, client.id, photoFile);
          if (uploaded?.path) {
            await updateClient(client.id, { avatar_url: uploaded.path });
            avatarUrlForList = uploaded.url || uploaded.path;
          }
        } catch (e) {
          console.warn("[Clientes] Upload da foto falhou:", e);
          toast("Cliente criado, mas a foto não foi enviada. Verifique o bucket 'client-photos' e as políticas RLS no Supabase.");
        }
      }
    }

    await audit({
      action: "cliente.create",
      tableName: "clients",
      recordId: client.id,
      permissionUsed: "clientes:manage",
    });

    const agendarApos = document.getElementById("agendarAposCadastro")?.checked;
    closeModal();
    await new Promise((r) => setTimeout(r, 400));
    await loadClientes();
    toast("Cliente criado");
    if (state === "pre_cadastro" && client?.id) {
      try {
        const { url } = await createClientPortalSession(client.id);
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          toast("Link para o cliente completar o cadastro foi copiado. Envie para o cliente.");
        } else {
          setTimeout(() => prompt("Copie o link e envie para o cliente completar o cadastro:", url), 500);
        }
      } catch (e) {
        console.warn("[Clientes] Link portal:", e);
      }
    }
    if (client?.id && agendarApos) {
      sessionStorage.setItem("agendaPrefillClientId", client.id);
      navigate("agenda");
      toast("Escolha o horário: a pessoa já vem selecionada.");
      return;
    }
    if (client?.id) {
      const abrirAnamnese = confirm("Deseja abrir a anamnese deste cliente agora?");
      if (abrirAnamnese) {
        sessionStorage.setItem("anamnese_client_id", client.id);
        sessionStorage.removeItem("anamnese_agenda_id");
        sessionStorage.removeItem("anamnese_procedimento");
        navigate("anamnese");
      }
    }
  } catch (err) {
    console.error(err);
    const msg = err?.message || "Erro ao criar cliente";
    if (/CPF|duplicad|já existe/i.test(msg)) {
      toast(msg, "warn");
    } else {
      toast(msg);
    }
  }
}
