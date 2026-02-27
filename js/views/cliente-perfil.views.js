import { getClientById, getOtherClientWithSameCpf, updateClient, updateClientState, uploadClientPhoto, createClientPortalSession, CLIENT_STATES } from "../services/clientes.service.js";
import { getEventsByClient, createClientEvent } from "../services/client-events.service.js";
import { getSkincareRotinaByClient, upsertSkincareRotina, liberarSkincareRotina } from "../services/skincare-rotina.service.js";
import { getProtocolos, getProtocolosAplicadosByClient, createProtocoloAplicado, getAlertaEstoqueProtocolo } from "../services/protocolo-db.service.js";
import { getResumoPorProduto } from "../services/estoque-entradas.service.js";
import { createEstudoCaso } from "../services/estudo-caso.service.js";
import { listRegistrosByClient } from "../services/anamnesis.service.js";
import { listEvolutionPhotosByClient, addEvolutionPhoto, deleteEvolutionPhoto } from "../services/evolution-photos.service.js";
import { listProcedures } from "../services/procedimentos.service.js";
import { listPacotesByClient, createPacote } from "../services/pacotes.service.js";
import { audit } from "../services/audit.service.js";
import { checkPermission } from "../core/permissions.js";
import { getActiveOrg } from "../core/org.js";
import { openModal, closeModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { navigate } from "../core/spa.js";
import { MAPAS, PRODUTOS_APLICACAO } from "../utils/injetaveis-mapas.js";

let currentClient = null;
/** Registros de anamnese injetáveis (rosto_injetaveis) para abrir o mapa pelo id */
let cachedRegistrosInjetaveis = [];
/** Stream da câmera no modal de editar cliente */
let cameraStream = null;
/** Data URL da foto capturada pela câmera (garante uso no submit mesmo antes do toBlob) */
let capturedPhotoDataUrl = null;
/** Blob da foto capturada (preenchido assincronamente pelo toBlob) */
let capturedPhotoBlob = null;
/** Se o usuário pode editar cliente (usado no callback do modal após salvar) */
let canEditClient = false;

let editPermissionUsed = "clientes:manage"; // qual permissão usar na auditoria (manage ou edit)
let cachedProceduresList = [];
let cachedEvolutionPhotos = [];
let cachedProdutosEstoque = [];

export async function init() {
  const clientId = sessionStorage.getItem("clientePerfilId");
  if (!clientId) {
    toast("Cliente não informado");
    navigate("clientes");
    return;
  }

  const container = document.getElementById("clientePerfilContent");
  if (!container) return;

  try {
    currentClient = await getClientById(clientId);
    const [events, skincareRotina, protocolos, protocolosAplicados, registrosAnamnese, evolutionPhotos, proceduresList, resumoEstoque, cpfOther, pacotes] = await Promise.all([
      getEventsByClient(clientId),
      getSkincareRotinaByClient(clientId).catch(() => null),
      getProtocolos().catch(() => []),
      getProtocolosAplicadosByClient(clientId).catch(() => []),
      listRegistrosByClient(clientId).catch(() => []),
      listEvolutionPhotosByClient(clientId).catch(() => []),
      listProcedures(false).catch(() => []),
      getResumoPorProduto().catch(() => []),
      currentClient.cpf ? getOtherClientWithSameCpf(currentClient.cpf, clientId).catch(() => null) : Promise.resolve(null),
      listPacotesByClient(clientId).catch(() => []),
    ]);
    const produtosEstoque = (resumoEstoque || []).map((r) => (r.produto_nome || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
    const canManage = await checkPermission("clientes:manage");
    const canEditPerm = await checkPermission("clientes:edit");
    canEditClient = canManage || canEditPerm;
    editPermissionUsed = canManage ? "clientes:manage" : "clientes:edit";
    renderPerfil(currentClient, events, canEditClient, skincareRotina, protocolos, protocolosAplicados, registrosAnamnese, evolutionPhotos, proceduresList, produtosEstoque, cpfOther, pacotes);
    if (sessionStorage.getItem("clientePerfilOpenEdit") === "1") {
      sessionStorage.removeItem("clientePerfilOpenEdit");
      if (canEditClient) setTimeout(() => openEditModal(currentClient), 100);
    }
    const openTab = sessionStorage.getItem("clientePerfilOpenTab");
    if (openTab === "protocolo") {
      sessionStorage.removeItem("clientePerfilOpenTab");
      document.querySelector('.tab-btn[data-tab="protocolo"]')?.click();
    }
  } catch (err) {
    console.error(err);
    toast("Erro ao carregar perfil do cliente");
    navigate("clientes");
  }
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function stateLabel(state) {
  return CLIENT_STATES[state] || state || "—";
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function formatCpfForInput(cpf) {
  if (!cpf || typeof cpf !== "string") return "";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function renderPerfil(client, events, canEdit = false, skincareRotina = null, protocolos = [], protocolosAplicados = [], registrosAnamnese = [], evolutionPhotos = [], proceduresList = [], produtosEstoque = [], cpfOther = null, pacotes = []) {
  const container = document.getElementById("clientePerfilContent");
  if (!container) return;
  cachedProceduresList = proceduresList || [];
  cachedEvolutionPhotos = evolutionPhotos || [];
  cachedProdutosEstoque = produtosEstoque || [];
  const rotinaConteudo = skincareRotina?.conteudo ?? "";
  const rotinaLiberada = !!skincareRotina?.liberado_em;
  const rotinaUpdated = skincareRotina?.updated_at;

  const initials = (client.name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] || "").toUpperCase())
    .join("");
  const avatarHtml = client.avatar_url
    ? `<img class="clientes-avatar" src="${escapeHtml(client.avatar_url)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling?.classList.remove('hidden')">`
    : "";
  container.innerHTML = `
    <div class="cliente-perfil">
      <div class="cliente-perfil-header">
        <div class="cliente-perfil-header-left">
          <span class="clientes-avatar-wrap clientes-avatar-wrap--perfil">
            ${avatarHtml}
            <span class="clientes-avatar-initials ${avatarHtml ? "hidden" : ""}">${escapeHtml(initials)}</span>
          </span>
          <div class="cliente-perfil-title">
            <button type="button" class="btn-back" id="btnVoltarClientes" title="Voltar">← Voltar</button>
            <h2>${escapeHtml(client.name)}</h2>
            <p class="cliente-perfil-meta">
              <span class="cliente-state-badge cliente-state-${(client.state || client.status || "").replace("_", "-")}">${stateLabel(client.state || client.status)}</span>
              ${client.phone ? ` · ${escapeHtml(client.phone)}` : ""}
              ${client.email ? ` · ${escapeHtml(client.email)}` : ""}
            </p>
            ${registrosAnamnese.length ? `<p class="cliente-perfil-anamnese-meta">Anamnese salva · Última: ${escapeHtml((registrosAnamnese[0].created_at ? new Date(registrosAnamnese[0].created_at).toLocaleDateString("pt-BR") : "—"))}</p>` : ""}
          </div>
        </div>
        <div class="cliente-perfil-actions">
          <button type="button" class="btn-primary" id="btnAnamneseCliente" title="Ficha de anamnese e análise de caso">Anamnese</button>
          ${canEdit ? '<button type="button" class="btn-primary" id="btnEditarCliente">Editar cliente</button>' : ""}
          ${canEdit && (client.state || client.status) === "pre_cadastro" && !client.registration_completed_at ? `
            <button type="button" class="btn-secondary" id="btnEnviarLinkCadastro">Enviar link para completar cadastro</button>
          ` : ""}
          ${(client.state || client.status) === "arquivado" && canEdit ? `
            <button type="button" class="btn-primary btn-state" data-state="em_acompanhamento">Retornar ao tratamento</button>
          ` : ""}
          ${(client.state || client.status) === "pausado" && canEdit ? `
            <button type="button" class="btn-primary btn-state" data-state="em_acompanhamento">Retornar ao acompanhamento</button>
          ` : ""}
          ${canChangeState(client) ? `
            <button type="button" class="btn-secondary btn-state" data-state="pausado" ${(client.state || client.status) === "pausado" ? "disabled" : ""}>Pausar</button>
            <button type="button" class="btn-secondary btn-state" data-state="alta" ${(client.state || client.status) === "alta" ? "disabled" : ""}>Dar alta</button>
            <button type="button" class="btn-secondary btn-state btn-archive" data-state="arquivado">Arquivar</button>
          ` : ""}
        </div>
      </div>

      <div class="cliente-perfil-tabs">
        <button type="button" class="tab-btn active" data-tab="dados">Dados do cliente</button>
        <button type="button" class="tab-btn" data-tab="historico">Histórico / Linha do tempo</button>
        <button type="button" class="tab-btn" data-tab="protocolo">Protocolo</button>
        <button type="button" class="tab-btn" data-tab="evolucao">Evolução</button>
        <button type="button" class="tab-btn" data-tab="rotina-skincare">Rotina skincare</button>
        <button type="button" class="tab-btn" data-tab="pacotes">Pacotes</button>
      </div>

      <div id="tabDados" class="tab-pane active">
        <div class="cliente-dados">
          <p class="cliente-perfil-anamnese-link"><button type="button" class="btn-link btn-open-anamnese" title="Abrir ficha de anamnese e evolução">Abrir anamnese</button></p>
          ${cpfOther ? `<div class="form-warning cliente-cpf-duplicado-aviso" role="alert"><strong>Atenção:</strong> Outro cliente nesta organização possui o mesmo CPF: ${escapeHtml(cpfOther.name || "cliente cadastrado")}. Revise os cadastros para evitar duplicidade.</div>` : ""}
          <p><strong>Nome:</strong> ${escapeHtml(client.name)} ${client.is_paciente_modelo ? '<span class="cliente-badge-modelo">Paciente modelo</span>' : ""}</p>
          ${client.is_paciente_modelo && client.model_discount_pct != null ? `<p><strong>Desconto modelo:</strong> ${Number(client.model_discount_pct)}%</p>` : ""}
          <p><strong>Contato:</strong> ${escapeHtml(client.phone || "—")} / ${escapeHtml(client.email || "—")}</p>
          ${client.cpf ? `<p><strong>CPF:</strong> ${formatCpfForInput(client.cpf)}</p>` : ""}
          <p><strong>Nascimento:</strong> ${formatDate(client.birth_date)}</p>
          <p><strong>Sexo:</strong> ${escapeHtml(client.sex || "—")}</p>
          <p><strong>Observações:</strong> ${escapeHtml(client.notes || "—")}</p>
          <p><strong>Criação:</strong> ${formatDate(client.created_at)}</p>
          ${client.consent_terms_accepted_at
            ? `<div class="cliente-consent-block">
                <p><strong>Termo de consentimento:</strong> aceito em ${formatDateTime(client.consent_terms_accepted_at)}${client.consent_terms_version ? ` (${escapeHtml(client.consent_terms_version)})` : ""}</p>
                ${client.consent_signed_name ? `<p><strong>Assinado por extenso:</strong> ${escapeHtml(client.consent_signed_name)}</p>` : ""}
                ${client.consent_signature_method ? `<p><strong>Forma de assinatura:</strong> ${client.consent_signature_method === "portal_link" ? "Link enviado ao cliente (assinou no aparelho dele)" : client.consent_signature_method === "presencial_digital" ? "Assinatura presencial neste aparelho" : "Registrado em papel"}</p>` : ""}
                <p><strong>Uso de imagem para divulgação:</strong> ${client.consent_image_use ? "Sim" : "Não"}</p>
              </div>`
            : `<div class="cliente-consent-block">
                <p><strong>Termo de consentimento:</strong> <span class="cliente-consent-pendente">Pendente</span></p>
                ${canEdit ? `
                <p class="client-hint">Envie o link para o cliente assinar no aparelho dele ou registre a assinatura presencial (nome por extenso) ou em papel.</p>
                <div class="cliente-consent-actions">
                  <button type="button" class="btn-secondary btn-sm" id="btnEnviarLinkTermo">Enviar link para o cliente assinar</button>
                  <button type="button" class="btn-secondary btn-sm" id="btnRegistrarTermoPresencial">Assinatura presencial (neste aparelho)</button>
                  <button type="button" class="btn-secondary btn-sm" id="btnRegistrarTermoPapel">Registrar aceite (assinatura em papel)</button>
                </div>` : ""}
              </div>`}
        </div>
      </div>

      <div id="tabHistorico" class="tab-pane hidden">
        <div class="cliente-historico">
          <p class="cliente-perfil-anamnese-link"><button type="button" class="btn-link btn-open-anamnese" title="Abrir ficha de anamnese e evolução">Abrir anamnese</button></p>
          <button type="button" class="btn-primary" id="btnRegistrarEvento">Registrar evento</button>
          <ul class="timeline" id="clienteTimeline">
            ${events.length ? events.map((e) => `
              <li class="timeline-item ${e.is_critical ? "timeline-critical" : ""}">
                <span class="timeline-date">${formatDate(e.event_date)}</span>
                <span class="timeline-type">${escapeHtml(e.event_type)}</span>
                ${e.description ? `<p>${escapeHtml(e.description)}</p>` : ""}
                ${e.created_by_client ? "<small>Relato do cliente</small>" : ""}
              </li>
            `).join("") : "<li>Nenhum evento registrado.</li>"}
          </ul>
          <div class="cliente-prontuario-por-data">
            <h4 class="cliente-evolucao-title">Prontuário por data</h4>
            <p class="client-hint">Cada dia reúne: ficha de anamnese salva naquela data, registro do que foi feito (protocolo) e fotos do dia. Use para ver tudo que aconteceu em um atendimento.</p>
            <div id="prontuarioPorDataList" class="prontuario-por-data-list">
              ${renderProntuarioPorData(registrosAnamnese, protocolosAplicados, evolutionPhotos)}
            </div>
          </div>
          <div class="cliente-evolucao">
            <h4 class="cliente-evolucao-title">Documentos de anamnese no prontuário</h4>
            <p class="client-hint cliente-evolucao-hint">Fichas e evoluções já salvas ficam aqui. Cada documento é estático no prontuário. Use o botão <strong>Anamnese</strong> para abrir a ficha e ver o histórico completo ou adicionar novo registro.</p>
            <div class="cliente-evolucao-list">
              ${renderEvolucaoCards(registrosAnamnese)}
            </div>
          </div>
          ${renderMapaInjetaveisSection(registrosAnamnese)}
          <div class="cliente-evolucao-fotos-ad" id="clienteEvolutionPhotosWrap">
            <h4 class="cliente-evolucao-title">Fotos antes/depois</h4>
            <p class="client-hint">Registre fotos de evolução por data e tipo (antes ou depois). Opcionalmente associe a um procedimento. Use <strong>Comparar fotos</strong> para ver duas fotos lado a lado.</p>
            <div id="clienteEvolutionPhotosCompareWrap" class="cliente-evolucao-fotos-compare-wrap" style="${(evolutionPhotos || []).length >= 2 ? "" : "display:none"}">
              <button type="button" class="btn-secondary" id="btnCompararFotos">Comparar fotos</button>
            </div>
            <div id="clienteEvolutionPhotosList" class="cliente-evolucao-fotos-list">
              ${renderEvolutionPhotosList(evolutionPhotos, proceduresList)}
            </div>
            ${canEdit ? `
            <form id="clienteEvolutionPhotosForm" class="cliente-evolucao-fotos-form">
              <label>Data da foto</label>
              <input type="date" id="evolutionPhotoDate" required>
              <label>Tipo</label>
              <select id="evolutionPhotoType">
                <option value="antes">Antes</option>
                <option value="depois">Depois</option>
              </select>
              <label>Procedimento (opcional)</label>
              <select id="evolutionPhotoProcedure">
                <option value="">— Nenhum —</option>
                ${(proceduresList || []).map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}
              </select>
              <label>Foto</label>
              <input type="file" id="evolutionPhotoFile" accept="image/jpeg,image/png,image/webp" required>
              <label>Observação (opcional)</label>
              <input type="text" id="evolutionPhotoNotes" placeholder="Ex.: área, sessão 3">
              <button type="submit" class="btn-primary">Adicionar foto</button>
            </form>
            ` : ""}
          </div>
        </div>
      </div>

      <div id="tabProtocolo" class="tab-pane hidden">
        <div class="cliente-protocolo">
          <p class="cliente-perfil-anamnese-link"><button type="button" class="btn-link btn-open-anamnese" title="Abrir ficha de anamnese e evolução">Abrir anamnese</button></p>
          <p class="client-hint">Registre o que foi feito no atendimento: descrição, produtos usados (do estoque) e, se quiser, um protocolo cadastrado. O registro fica ligado ao prontuário e à data.</p>
          <div class="protocolo-registro-form">
            <label for="protocoloData">Data do atendimento</label>
            <input type="date" id="protocoloData" value="${(function(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");})()}">
            <label for="protocoloDescricao">O que foi feito</label>
            <textarea id="protocoloDescricao" rows="3" placeholder="Ex.: Limpeza de pele, aplicação de toxina na região frontal, peelings..."></textarea>
            <div class="protocolo-produtos-wrap">
              <label>Produtos utilizados (estoque)</label>
              <p class="client-hint protocolo-produtos-hint">Adicione os produtos que foram usados; o estoque será atualizado.</p>
              <div class="protocolo-produtos-add">
                <select id="protocoloProdutoSelect">
                  <option value="">— Selecione um produto —</option>
                  ${(produtosEstoque || []).map((nome) => `<option value="${escapeHtml(nome)}">${escapeHtml(nome)}</option>`).join("")}
                </select>
                <input type="number" id="protocoloProdutoQty" min="0.01" step="0.01" value="1" style="width:4rem;">
                <button type="button" class="btn-secondary" id="btnProtocoloAddProduto">Adicionar</button>
              </div>
              <ul id="protocoloProdutosList" class="protocolo-produtos-list"></ul>
            </div>
            <label for="protocoloSelect">Protocolo cadastrado (opcional)</label>
            <select id="protocoloSelect">
              <option value="">— Nenhum —</option>
              ${(protocolos || []).map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)}</option>`).join("")}
            </select>
            <label for="protocoloObservacao">Observação (opcional)</label>
            <textarea id="protocoloObservacao" rows="2" placeholder="Ex.: área aplicada, reação..."></textarea>
            <button type="button" class="btn-primary" id="btnRegistrarProtocolo">Registrar no prontuário</button>
          </div>
          <h4 class="protocolo-hist-title">Histórico de registros (por data)</h4>
          <ul class="protocolo-aplicados-list" id="protocoloAplicadosList">
            ${(protocolosAplicados || []).length ? (protocolosAplicados || []).map((a) => renderProtocoloAplicadoItem(a)) : "<li>Nenhum registro ainda.</li>"}
          </ul>
          <div class="protocolo-estudo-caso-wrap">
            <h4 class="protocolo-hist-title">Registrar para estudo de caso (anonimizado)</h4>
            <p class="client-hint">Tipo de pele e fototipo são diferentes. Protocolo = procedimento aplicado; análise de pele = avaliação. Dados anonimizados; use a tela <strong>Estudo de caso</strong> para perguntas.</p>
            <div class="estudo-caso-form-row">
              <div class="estudo-caso-form-field">
                <label>Tipo de pele</label>
                <select id="estudoCasoTipoPelePerfil">
                  <option value="">— Opcional —</option>
                  <option value="oleosa">Oleosa</option>
                  <option value="mista">Mista</option>
                  <option value="seca">Seca</option>
                  <option value="normal">Normal</option>
                  <option value="sensivel">Sensível</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div class="estudo-caso-form-field">
                <label>Fototipo (Fitzpatrick)</label>
                <select id="estudoCasoFototipoPerfil">
                  <option value="">— Opcional —</option>
                  <option value="I">I</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                  <option value="IV">IV</option>
                  <option value="V">V</option>
                  <option value="VI">VI</option>
                </select>
              </div>
            </div>
            <label>Queixa principal</label>
            <input type="text" id="estudoCasoQueixaPerfil" placeholder="Ex.: melasma, acne">
            <label>Análise de pele (resumo, opcional)</label>
            <textarea id="estudoCasoAnalisePelePerfil" rows="2" placeholder="Resumo da avaliação da pele"></textarea>
            <label>Resposta observada</label>
            <select id="estudoCasoRespostaPerfil">
              <option value="">— Selecione —</option>
              <option value="melhora">Melhora</option>
              <option value="sem_mudanca">Sem mudança</option>
              <option value="efeito_adverso">Efeito adverso</option>
            </select>
            <label>Nº de sessões (opcional)</label>
            <input type="number" id="estudoCasoNSessoesPerfil" min="1" placeholder="Ex.: 6">
            <button type="button" class="btn-secondary" id="btnRegistrarEstudoCasoPerfil">Registrar para estudo de caso</button>
          </div>
        </div>
      </div>

      <div id="tabEvolucao" class="tab-pane hidden">
        <div class="cliente-evolucao-aba">
          <p class="cliente-perfil-anamnese-link"><button type="button" class="btn-link btn-open-anamnese" title="Abrir anamnese">Abrir anamnese</button></p>
          <p class="client-hint cliente-evolucao-aba-hint">Fotos antes e depois para acompanhar a evolução do tratamento. Use para <strong>mostrar ao cliente a melhora</strong> e incentivar a continuidade; também para <strong>montar conteúdo para redes sociais</strong> (com autorização de uso de imagem).</p>
          <div class="cliente-evolucao-aba-actions">
            ${(evolutionPhotos || []).length >= 2 ? `<button type="button" class="btn-primary" id="btnCompararFotosEvolucao">Comparar fotos</button>` : ""}
            <button type="button" class="btn-secondary" id="btnRelatorioEvolucao">Relatório antes/depois</button>
          </div>
          <div class="cliente-evolucao-aba-galeria">
            <h4 class="cliente-evolucao-title">Galeria de evolução</h4>
            <div id="clienteEvolutionPhotosListEvolucao" class="cliente-evolucao-fotos-grid cliente-evolucao-fotos-grid--aba">
              ${(evolutionPhotos || []).length ? (evolutionPhotos || []).map((ph) => {
                const procName = (proceduresList || []).find((p) => p.id === ph.procedure_id)?.name || "";
                return `<div class="cliente-evolucao-foto-item" data-id="${ph.id}">
                  <a href="${escapeHtml(ph.photo_url)}" target="_blank" rel="noopener" class="cliente-evolucao-foto-link">
                    <img src="${escapeHtml(ph.photo_url)}" alt="" class="cliente-evolucao-foto-thumb" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23f1f5f9%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2255%22 fill=%22%2394a3b8%22 text-anchor=%22middle%22 font-size=%2212%22%3EErro%3C/text%3E%3C/svg%3E'">
                  </a>
                  <div class="cliente-evolucao-foto-meta">
                    <span class="cliente-evolucao-foto-date">${formatDate(ph.taken_at)}</span>
                    <span class="cliente-evolucao-foto-type cliente-evolucao-foto-type--${ph.type}">${ph.type === "depois" ? "Depois" : "Antes"}</span>
                    ${procName ? `<span class="cliente-evolucao-foto-proc">${escapeHtml(procName)}</span>` : ""}
                    ${ph.notes ? `<span class="cliente-evolucao-foto-notes">${escapeHtml(ph.notes)}</span>` : ""}
                  </div>
                </div>`;
              }).join("") : "<p class=\"cliente-evolucao-empty\">Nenhuma foto de evolução. Adicione fotos na aba <strong>Histórico</strong> (seção Fotos antes/depois) para montar a galeria e comparativos.</p>"}
            </div>
          </div>
        </div>
      </div>

      <div id="tabRotinaSkincare" class="tab-pane hidden">
        <div class="cliente-rotina-skincare">
          <p class="cliente-perfil-anamnese-link"><button type="button" class="btn-link btn-open-anamnese" title="Abrir ficha de anamnese e evolução">Abrir anamnese</button></p>
          <p class="client-hint">Rotina de cuidados que o cliente verá no portal. Libere no portal após validar (e cobrar, se aplicável).</p>
          ${rotinaLiberada ? `<p class="skincare-rotina-liberada">Liberada no portal em ${formatDateTime(skincareRotina?.liberado_em)}</p>` : ""}
          ${canEdit ? `
            <div class="skincare-rotina-actions skincare-rotina-actions--top">
              <button type="button" class="btn-secondary" id="btnGerarRotinaIA" title="Abre a tela Skincare IA com dados deste cliente e da anamnese já preenchidos">Gerar rotina com IA</button>
            </div>
            <textarea id="skincareRotinaConteudo" rows="12" placeholder="Ex.: Manhã: limpeza, vitamina C, hidratante, protetor. Noite: limpeza, retinol, hidratante. Orientações: evitar sol forte...">${escapeHtml(rotinaConteudo)}</textarea>
            <div class="skincare-rotina-actions">
              <button type="button" class="btn-primary" id="btnSalvarRotinaSkincare">Salvar rotina</button>
              <button type="button" class="btn-secondary" id="btnLiberarRotinaSkincare" ${!rotinaConteudo.trim() ? "disabled" : ""}>Liberar no portal</button>
            </div>
          ` : `
            <div class="skincare-rotina-conteudo-readonly">${(rotinaConteudo || "Nenhuma rotina cadastrada.").split("\n").map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</div>
          `}
          ${rotinaUpdated ? `<small class="skincare-rotina-updated">Última atualização: ${formatDateTime(rotinaUpdated)}</small>` : ""}
        </div>
      </div>

      <div id="tabPacotes" class="tab-pane hidden">
        <div class="cliente-pacotes">
          <p class="client-hint">Pacotes de sessões vendidos a este cliente. Dê baixa ao concluir cada atendimento (na Agenda, ao dar baixa no agendamento, ou manualmente aqui).</p>
          ${canEdit ? `<button type="button" class="btn-primary" id="btnVenderPacote">+ Vender pacote</button>` : ""}
          <ul id="clientePacotesList" class="cliente-pacotes-list">
            ${(pacotes || []).length ? (pacotes || []).map((p) => {
              const restantes = p.sessoes_restantes ?? Math.max(0, (p.total_sessoes ?? 0) - (p.sessoes_utilizadas ?? 0));
              const valido = !p.valido_ate || new Date(p.valido_ate) >= new Date();
              return `<li class="cliente-pacote-item ${restantes === 0 ? "cliente-pacote-esgotado" : ""} ${!valido ? "cliente-pacote-vencido" : ""}" data-package-id="${p.id}">
                <span class="cliente-pacote-nome">${escapeHtml(p.nome_pacote)}</span>
                ${p.procedure_name ? `<span class="cliente-pacote-proc">${escapeHtml(p.procedure_name)}</span>` : ""}
                <span class="cliente-pacote-sessoes">${p.sessoes_utilizadas ?? 0} / ${p.total_sessoes ?? 0} sessões</span>
                ${restantes > 0 && valido ? `<span class="cliente-pacote-restantes">${restantes} restantes</span>` : ""}
                ${p.valido_ate ? `<span class="cliente-pacote-valido">Válido até ${formatDate(p.valido_ate)}</span>` : ""}
                ${p.valor_pago != null ? `<span class="cliente-pacote-valor">R$ ${Number(p.valor_pago).toFixed(2).replace(".", ",")}</span>` : ""}
              </li>`;
            }).join("") : "<li class=\"cliente-pacotes-empty\">Nenhum pacote. Clique em \"Vender pacote\" para registrar.</li>"}
          </ul>
        </div>
      </div>
    </div>
  `;

  bindPerfilEvents(client, canEdit, proceduresList, pacotes);
}

function dateKey(d) {
  if (!d) return "";
  const s = typeof d === "string" ? d : d.toISOString ? d.toISOString() : String(d);
  return s.slice(0, 10);
}

function renderProntuarioPorData(registrosAnamnese, protocolosAplicados, evolutionPhotos) {
  const byDate = {};
  const add = (key, type, item) => {
    if (!key) return;
    if (!byDate[key]) byDate[key] = { anamnese: [], protocolos: [], fotos: [] };
    byDate[key][type].push(item);
  };
  (registrosAnamnese || []).forEach((r) => add(dateKey(r.created_at), "anamnese", r));
  (protocolosAplicados || []).forEach((a) => add(dateKey(a.aplicado_em), "protocolos", a));
  (evolutionPhotos || []).forEach((ph) => add(dateKey(ph.taken_at), "fotos", ph));
  const dates = Object.keys(byDate).filter(Boolean).sort().reverse();
  if (dates.length === 0) {
    return "<p class=\"cliente-evolucao-empty\">Nenhum registro por data ainda. Registre anamnese, protocolo ou fotos para ver o prontuário por dia.</p>";
  }
  return dates.map((key) => {
    const d = byDate[key];
    const dataBr = new Date(key + "T12:00:00").toLocaleDateString("pt-BR");
    const anamneseItems = (d.anamnese || []).slice(0, 3).map((r) => {
      const nome = r.anamnesis_funcoes?.nome || "Anamnese";
      const resumo = (r.conteudo || "").trim().slice(0, 80) + ((r.conteudo || "").length > 80 ? "…" : "");
      return `<span class="prontuario-data-badge prontuario-data-badge--anamnese">${escapeHtml(nome)}${resumo ? ": " + escapeHtml(resumo) : ""}</span>`;
    }).join("");
    const protocoloItems = (d.protocolos || []).slice(0, 5).map((a) => {
      const nome = a.protocolos?.nome || (a.descricao || "").trim().slice(0, 40) || "Registro";
      const desc = (a.descricao || "").trim().slice(0, 60);
      return `<span class="prontuario-data-badge prontuario-data-badge--protocolo">${escapeHtml(nome)}${desc ? " — " + escapeHtml(desc) + (a.descricao?.length > 60 ? "…" : "") : ""}</span>`;
    }).join("");
    const fotoItems = (d.fotos || []).slice(0, 4).map((ph) => {
      const tipo = ph.type === "depois" ? "Depois" : "Antes";
      return `<a href="${escapeHtml(ph.photo_url)}" target="_blank" rel="noopener" class="prontuario-data-foto-thumb" title="${tipo}"><img src="${escapeHtml(ph.photo_url)}" alt="" loading="lazy"></a>`;
    }).join("");
    return `
      <div class="prontuario-por-data-card" data-date="${escapeHtml(key)}">
        <h5 class="prontuario-por-data-date">${dataBr}</h5>
        ${d.anamnese?.length ? `<div class="prontuario-por-data-anamnese">${anamneseItems}</div>` : ""}
        ${d.protocolos?.length ? `<div class="prontuario-por-data-protocolos">${protocoloItems}</div>` : ""}
        ${d.fotos?.length ? `<div class="prontuario-por-data-fotos">${fotoItems}</div>` : ""}
      </div>`;
  }).join("");
}

function renderProtocoloAplicadoItem(a) {
  const nome = a.protocolos?.nome || (a.descricao ? "" : "—");
  const desc = (a.descricao || "").trim();
  const prods = Array.isArray(a.produtos_usados) ? a.produtos_usados : [];
  const produtosStr = prods.length ? prods.map((p) => `${escapeHtml(p.produto_nome || "")}${(p.quantidade && p.quantidade !== 1) ? " × " + p.quantidade : ""}`).join(", ") : "";
  return `
    <li class="protocolo-aplicado-item">
      <span class="protocolo-aplicado-data">${formatDateTime(a.aplicado_em)}</span>
      ${nome ? `<span class="protocolo-aplicado-nome">${escapeHtml(nome)}</span>` : ""}
      ${desc ? `<p class="protocolo-aplicado-desc">${escapeHtml(desc)}</p>` : ""}
      ${produtosStr ? `<p class="protocolo-aplicado-produtos">Produtos: ${produtosStr}</p>` : ""}
      ${a.observacao ? `<p class="protocolo-aplicado-obs">${escapeHtml(a.observacao)}</p>` : ""}
    </li>`;
}

function canChangeState(client) {
  const s = client.state || client.status;
  return s && s !== "arquivado";
}

function escapeHtml(s) {
  if (!s) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function renderEvolutionPhotosList(photos, proceduresList = []) {
  const procMap = (proceduresList || []).reduce((acc, p) => { acc[p.id] = p.name; return acc; }, {});
  if (!photos || photos.length === 0) {
    return `<p class="cliente-evolucao-empty">Nenhuma foto de evolução ainda. Use o formulário abaixo para adicionar fotos antes/depois.</p>`;
  }
  return `<div class="cliente-evolucao-fotos-grid">${photos.map((ph) => {
    const procName = ph.procedure_id ? (procMap[ph.procedure_id] || "—") : "";
    return `
      <div class="cliente-evolucao-foto-item" data-id="${ph.id}">
        <a href="${escapeHtml(ph.photo_url)}" target="_blank" rel="noopener" class="cliente-evolucao-foto-link">
          <img src="${escapeHtml(ph.photo_url)}" alt="" class="cliente-evolucao-foto-thumb" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23f1f5f9%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2255%22 fill=%22%2394a3b8%22 text-anchor=%22middle%22 font-size=%2212%22%3EErro%3C/text%3E%3C/svg%3E'">
        </a>
        <div class="cliente-evolucao-foto-meta">
          <span class="cliente-evolucao-foto-date">${formatDate(ph.taken_at)}</span>
          <span class="cliente-evolucao-foto-type">${ph.type === "depois" ? "Depois" : "Antes"}</span>
          ${procName ? `<span class="cliente-evolucao-foto-proc">${escapeHtml(procName)}</span>` : ""}
          ${ph.notes ? `<span class="cliente-evolucao-foto-notes">${escapeHtml(ph.notes)}</span>` : ""}
          <button type="button" class="btn-evolution-photo-delete btn-sm" data-id="${ph.id}" title="Excluir foto">Excluir</button>
        </div>
      </div>
    `;
  }).join("")}</div>`;
}

function renderEvolucaoCards(registros) {
  if (!Array.isArray(registros) || registros.length === 0) {
    return `<p class="cliente-evolucao-empty">Nenhum documento de anamnese salvo ainda. Use o botão <strong>Anamnese</strong> para preencher e salvar a primeira ficha; ela ficará fixa aqui no prontuário.</p>`;
  }
  const byFuncao = {};
  for (const r of registros) {
    const slug = r.anamnesis_funcoes?.slug || "geral";
    if (!byFuncao[slug]) byFuncao[slug] = [];
    if (byFuncao[slug].length < 6) byFuncao[slug].push(r);
  }
  const urlDeFoto = (f) => (typeof f === "string" ? f : f?.url);
  const cards = Object.entries(byFuncao).map(([slug, list]) => {
    const nome = list[0].anamnesis_funcoes?.nome || slug;
    const ultimo = list[0];
    const data = ultimo.created_at ? new Date(ultimo.created_at).toLocaleDateString("pt-BR") : "—";
    const resumo = ultimo.conteudo && ultimo.conteudo.trim()
      ? escapeHtml(ultimo.conteudo.trim().slice(0, 120)) + (ultimo.conteudo.length > 120 ? "…" : "")
      : "";
    const fotosArr = Array.isArray(ultimo.fotos) ? ultimo.fotos : [];
    const urls = fotosArr.slice(0, 3).map(urlDeFoto).filter(Boolean);
    const fotos = urls.length
      ? `<div class="cliente-evolucao-fotos">${urls.map((url) => `<img src="${escapeHtml(url)}" alt="" class="cliente-evolucao-foto-thumb">`).join("")}</div>`
      : "";
    const temFicha = ultimo.ficha && typeof ultimo.ficha === "object" && Object.keys(ultimo.ficha).length > 0;
    const badge = temFicha ? " <span class=\"cliente-evolucao-badge\">Ficha salva</span>" : "";
    return `
      <div class="cliente-evolucao-card" data-funcao-slug="${escapeHtml(slug)}">
        <div class="cliente-evolucao-header">
          <span class="cliente-evolucao-area">${escapeHtml(nome)}</span>
          <span class="cliente-evolucao-data">${escapeHtml(data)}${badge}</span>
        </div>
        ${resumo ? `<p class="cliente-evolucao-resumo">${resumo}</p>` : ""}
        ${fotos}
      </div>
    `;
  });
  return cards.join("");
}

/** Registros de anamnese só de injetáveis (rosto_injetaveis) com pontos no mapa */
function getRegistrosInjetaveisComMapa(registros) {
  if (!Array.isArray(registros)) return [];
  return registros.filter((r) => {
    const slug = r.anamnesis_funcoes?.slug;
    if (slug !== "rosto_injetaveis") return false;
    const pts = r.ficha?.pontos_aplicacao;
    return Array.isArray(pts) && pts.length > 0;
  });
}

/** Seção "Mapa de injetáveis": lista separada com botão Ver mapa (abre modal ampliado) */
function renderMapaInjetaveisSection(registrosAnamnese) {
  const lista = getRegistrosInjetaveisComMapa(registrosAnamnese || []);
  cachedRegistrosInjetaveis = lista;
  if (lista.length === 0) return "";
  const cards = lista.map((r) => {
    const dataStr = r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "—";
    const pts = r.ficha.pontos_aplicacao || [];
    const byMapa = { rosto: 0, barriga: 0, gluteos: 0 };
    pts.forEach((p) => {
      const m = p.mapa || "rosto";
      if (byMapa[m] != null) byMapa[m]++;
    });
    const resumo = [
      byMapa.rosto ? byMapa.rosto + " pt(s) rosto" : "",
      byMapa.barriga ? byMapa.barriga + " pt(s) barriga" : "",
      byMapa.gluteos ? byMapa.gluteos + " pt(s) glúteos" : ""
    ].filter(Boolean).join(" · ") || "Pontos registrados";
    return `
      <div class="cliente-injetaveis-card" data-registro-id="${escapeHtml(r.id)}">
        <div class="cliente-injetaveis-card-header">
          <span class="cliente-injetaveis-data">${escapeHtml(dataStr)}</span>
          <button type="button" class="btn-primary btn-ver-mapa-injetaveis" data-registro-id="${escapeHtml(r.id)}" title="Abrir mapa com pontos de aplicação (onde foi feito, ml/UI, entrada da cânula)">Ver mapa</button>
        </div>
        <p class="cliente-injetaveis-resumo">${escapeHtml(resumo)}</p>
      </div>
    `;
  });
  return `
    <div class="cliente-mapa-injetaveis-wrap" id="clienteMapaInjetaveisWrap">
      <h4 class="cliente-evolucao-title">Mapa de injetáveis</h4>
      <p class="client-hint">Registros de anamnese (Rosto — Injetáveis) com pontos de aplicação. Clique em <strong>Ver mapa</strong> para ver onde foi aplicado, quantidades (ml/UI) e observações (ex.: entrada da cânula).</p>
      <div class="cliente-injetaveis-list">
        ${cards.join("")}
      </div>
    </div>
  `;
}

/** Abre modal com mapa ampliado: rosto, barriga, glúteos com pontos (produto, ml/UI, observação) */
function openMapaInjetaveisModal(registroId) {
  const registro = cachedRegistrosInjetaveis.find((r) => r.id === registroId);
  if (!registro || !registro.ficha?.pontos_aplicacao?.length) {
    toast("Registro não encontrado ou sem pontos de aplicação.");
    return;
  }
  const dataStr = registro.created_at ? new Date(registro.created_at).toLocaleDateString("pt-BR") : "";
  const pts = registro.ficha.pontos_aplicacao;
  const byMapa = { rosto: [], barriga: [], gluteos: [] };
  pts.forEach((p) => {
    const m = (p.mapa || "rosto").toLowerCase();
    if (byMapa[m]) byMapa[m].push(p);
  });

  const produtoLabel = (id) => PRODUTOS_APLICACAO.find((x) => x.id === id)?.label || id || "—";
  const pontoLine = (p) => {
    const nome = produtoLabel(p.produto);
    const qty = p.quantidade != null ? ` ${p.quantidade} ${p.unidade || ""}` : "";
    const obs = p.observacao ? ` · ${p.observacao}` : "";
    return nome + qty + obs;
  };

  const tabsHtml = MAPAS.map((m) => {
    const list = byMapa[m.id] || [];
    const dotsHtml = list.map((p) => {
      const x = (p.x_pct != null ? p.x_pct : 50);
      const y = (p.y_pct != null ? p.y_pct : 50);
      return `<div class="injetaveis-mapa-dot" style="left:${x}%;top:${y}%;" title="${escapeHtml(pontoLine(p))}"></div>`;
    }).join("");
    const listItems = list.map((p) => `<li class="injetaveis-mapa-lista-item">${escapeHtml(pontoLine(p))}</li>`).join("");
    return `
      <div class="injetaveis-mapa-panel" data-mapa="${m.id}" id="modalMapaPanel_${m.id}">
        <div class="injetaveis-mapa-svg-wrap">
          ${m.svg}
          <div class="injetaveis-mapa-dots">${dotsHtml}</div>
        </div>
        <div class="injetaveis-mapa-lista">
          <p class="injetaveis-mapa-lista-title">${escapeHtml(m.label)} — onde foi feito e quantidade</p>
          ${list.length ? `<ul class="injetaveis-mapa-ul">${listItems}</ul>` : "<p class=\"injetaveis-mapa-vazio\">Nenhum ponto nesta área.</p>"}
        </div>
      </div>
    `;
  }).join("");

  const tabButtons = MAPAS.map((m) => `<button type="button" class="injetaveis-mapa-tab" data-mapa="${m.id}">${escapeHtml(m.label)}</button>`).join("");

  const modalHtml = `
    <div class="injetaveis-mapa-modal-content">
      <p class="injetaveis-mapa-modal-data">Registro de ${escapeHtml(dataStr)}</p>
      <div class="injetaveis-mapa-tabs">${tabButtons}</div>
      ${tabsHtml}
      <div class="modal-actions" style="margin-top:1rem;">
        <button type="button" class="btn-secondary" id="btnFecharMapaInjetaveis">Fechar</button>
      </div>
    </div>
  `;
  openModal("Mapa de aplicação — onde foi feito (ml/UI, entrada da cânula)", modalHtml, () => closeModal(), null);

  const container = document.getElementById("modalFields");
  if (!container) return;
  container.querySelectorAll(".injetaveis-mapa-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      container.querySelectorAll(".injetaveis-mapa-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      container.querySelectorAll(".injetaveis-mapa-panel").forEach((p) => p.classList.add("hidden"));
      const panel = container.querySelector("#modalMapaPanel_" + tab.dataset.mapa);
      if (panel) panel.classList.remove("hidden");
    });
  });
  container.querySelector(".injetaveis-mapa-tab")?.classList.add("active");
  container.querySelectorAll(".injetaveis-mapa-panel").forEach((p, i) => {
    p.classList.toggle("hidden", i !== 0);
  });
  document.getElementById("btnFecharMapaInjetaveis")?.addEventListener("click", () => closeModal());
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

function maskCpfInput(input) {
  let v = input.value.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  input.value = v;
}

/** Máscara (00) 00000-0000 celular ou (00) 0000-0000 fixo */
function maskPhoneInput(input) {
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

function bindEvolutionPhotoDeletes(clientId) {
  document.querySelectorAll(".btn-evolution-photo-delete").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (!id) return;
      if (!confirm("Excluir esta foto do prontuário?")) return;
      try {
        await deleteEvolutionPhoto(id);
        toast("Foto removida.");
        const photos = await listEvolutionPhotosByClient(clientId);
        cachedEvolutionPhotos = photos;
        const listEl = document.getElementById("clienteEvolutionPhotosList");
        if (listEl) listEl.innerHTML = renderEvolutionPhotosList(photos, cachedProceduresList);
        updateCompararFotosWrap(photos);
        bindEvolutionPhotoDeletes(clientId);
        bindCompararFotos(clientId);
      } catch (err) {
        toast(err?.message || "Erro ao excluir.");
      }
    };
  });
}

function updateCompararFotosWrap(photos) {
  const wrap = document.getElementById("clienteEvolutionPhotosCompareWrap");
  if (!wrap) return;
  wrap.style.display = (photos || []).length >= 2 ? "" : "none";
}

function openCompararFotosModal(clientId) {
  const photos = cachedEvolutionPhotos || [];
  if (photos.length < 2) {
    toast("É preciso ter pelo menos 2 fotos para comparar.");
    return;
  }
  const options = photos.map((p, i) => `<option value="${i}">${formatDate(p.taken_at)} — ${p.type === "depois" ? "Depois" : "Antes"}${p.notes ? " — " + escapeHtml(p.notes) : ""}</option>`).join("");
  openModal(
    "Comparar fotos",
    `
    <p class="client-hint">Escolha duas fotos para ver lado a lado.</p>
    <div class="comparar-fotos-selects">
      <label>Primeira foto</label>
      <select id="comparePhoto1">${options}</select>
      <label>Segunda foto</label>
      <select id="comparePhoto2">${options}</select>
    </div>
    <div id="comparePhotosPreview" class="comparar-fotos-preview" aria-live="polite"></div>
    `,
    () => closeModal()
  );
  const sel1 = document.getElementById("comparePhoto1");
  const sel2 = document.getElementById("comparePhoto2");
  const preview = document.getElementById("comparePhotosPreview");
  function renderPreview() {
    const i1 = parseInt(sel1?.value, 10);
    const i2 = parseInt(sel2?.value, 10);
    if (isNaN(i1) || isNaN(i2) || !preview || !photos[i1] || !photos[i2]) return;
    const p1 = photos[i1];
    const p2 = photos[i2];
    preview.innerHTML = `
      <div class="comparar-fotos-lado">
        <img src="${escapeHtml(p1.photo_url)}" alt="Foto 1" class="comparar-fotos-img">
        <p class="comparar-fotos-legenda">${formatDate(p1.taken_at)} — ${p1.type === "depois" ? "Depois" : "Antes"}${p1.notes ? " · " + escapeHtml(p1.notes) : ""}</p>
      </div>
      <div class="comparar-fotos-lado">
        <img src="${escapeHtml(p2.photo_url)}" alt="Foto 2" class="comparar-fotos-img">
        <p class="comparar-fotos-legenda">${formatDate(p2.taken_at)} — ${p2.type === "depois" ? "Depois" : "Antes"}${p2.notes ? " · " + escapeHtml(p2.notes) : ""}</p>
      </div>
    `;
  }
  sel1?.addEventListener("change", renderPreview);
  sel2?.addEventListener("change", renderPreview);
  if (photos.length > 1) {
    sel2.value = "1";
  }
  renderPreview();
}

function bindCompararFotos(clientId) {
  document.getElementById("btnCompararFotos")?.addEventListener("click", () => openCompararFotosModal(clientId));
}

/** Abre relatório de evolução (fotos antes/depois) em nova janela para impressão ou uso em redes (com autorização). */
function openRelatorioEvolucaoModal(client) {
  const photos = cachedEvolutionPhotos || [];
  const nome = (client?.name || "Cliente").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const antes = photos.filter((p) => p.type !== "depois");
  const depois = photos.filter((p) => p.type === "depois");
  const win = window.open("", "_blank");
  if (!win) {
    toast("Permita pop-ups para abrir o relatório.");
    return;
  }
  const fotosHtml = (list, label) =>
    list.length
      ? `<div class="evolucao-col"><h3>${label}</h3><div class="evolucao-fotos">${list
          .slice(0, 6)
          .map(
            (ph) =>
              `<div class="evolucao-foto-item"><img src="${(ph.photo_url || "").replace(/"/g, "&quot;")}" alt=""><span class="evolucao-foto-meta">${formatDate(ph.taken_at)}${ph.notes ? " — " + String(ph.notes).replace(/</g, "&lt;") : ""}</span></div>`
          )
          .join("")}</div></div>`
      : "";
  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Evolução - ${nome}</title>
<style>body{font-family:system-ui,sans-serif;font-size:14px;color:#1e293b;margin:20px;background:#fff;} h1{font-size:20px;} h3{font-size:14px;margin:12px 0 6px;} .evolucao-grid{display:flex;gap:24px;margin-top:12px;flex-wrap:wrap;} .evolucao-col{flex:1;min-width:200px;} .evolucao-fotos{display:flex;flex-wrap:wrap;gap:8px;} .evolucao-foto-item{text-align:center;} .evolucao-foto-item img{width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;} .evolucao-foto-meta{display:block;font-size:11px;color:#64748b;margin-top:4px;} .footer{margin-top:24px;font-size:12px;color:#64748b;} @media print{.evolucao-foto-item img{width:140px;height:140px;}}</style>
</head>
<body>
  <h1>Evolução do tratamento — ${nome}</h1>
  <p>Relatório antes/depois para acompanhamento e, com autorização do cliente, uso em redes sociais.</p>
  <div class="evolucao-grid">${fotosHtml(antes, "Antes")}${fotosHtml(depois, "Depois")}</div>
  ${!photos.length ? "<p>Nenhuma foto de evolução registrada. Adicione na aba Histórico (Fotos antes/depois).</p>" : ""}
  <div class="footer">Gerado pelo SkinClinic. Use com autorização de imagem do cliente.</div>
  <script>window.onload=function(){window.print();};</script>
</body>
</html>`);
  win.document.close();
}

function bindPerfilEvents(client, canEdit) {
  document.getElementById("btnVoltarClientes")?.addEventListener("click", () => {
    closeModal();
    sessionStorage.removeItem("clientePerfilId");
    navigate("clientes");
  });

  const goToAnamnese = () => {
    sessionStorage.setItem("anamnese_client_id", client.id);
    sessionStorage.removeItem("anamnese_agenda_id");
    sessionStorage.removeItem("anamnese_procedimento");
    navigate("anamnese");
  };
  document.getElementById("btnAnamneseCliente")?.addEventListener("click", goToAnamnese);
  document.querySelectorAll(".btn-open-anamnese").forEach((btn) => btn.addEventListener("click", goToAnamnese));

  document.querySelectorAll(".cliente-evolucao-card").forEach((card) => {
    card.addEventListener("click", () => {
      const slug = card.dataset.funcaoSlug;
      if (!slug) return;
      sessionStorage.setItem("anamnese_client_id", client.id);
      sessionStorage.removeItem("anamnese_agenda_id");
      sessionStorage.removeItem("anamnese_procedimento");
      sessionStorage.setItem("anamnese_funcao_slug", slug);
      navigate("anamnese");
    });
  });

  document.querySelectorAll(".btn-ver-mapa-injetaveis").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openMapaInjetaveisModal(btn.dataset.registroId);
    });
  });

  const evolutionForm = document.getElementById("clienteEvolutionPhotosForm");
  if (evolutionForm && canEdit) {
    evolutionForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dateEl = document.getElementById("evolutionPhotoDate");
      const typeEl = document.getElementById("evolutionPhotoType");
      const procedureEl = document.getElementById("evolutionPhotoProcedure");
      const fileEl = document.getElementById("evolutionPhotoFile");
      const notesEl = document.getElementById("evolutionPhotoNotes");
      if (!dateEl?.value || !fileEl?.files?.length) {
        toast("Informe data e selecione uma foto.");
        return;
      }
      const btn = evolutionForm.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      try {
        await addEvolutionPhoto(
          client.id,
          dateEl.value,
          typeEl?.value || "antes",
          fileEl.files[0],
          procedureEl?.value || null,
          notesEl?.value?.trim() || null
        );
        toast("Foto adicionada.");
        fileEl.value = "";
        notesEl.value = "";
        const photos = await listEvolutionPhotosByClient(client.id);
        cachedEvolutionPhotos = photos;
        const listEl = document.getElementById("clienteEvolutionPhotosList");
        if (listEl) listEl.innerHTML = renderEvolutionPhotosList(photos, cachedProceduresList);
        updateCompararFotosWrap(photos);
        bindEvolutionPhotoDeletes(client.id);
        bindCompararFotos(client.id);
      } catch (err) {
        console.error(err);
        toast(err?.message || "Erro ao adicionar foto.");
      }
      if (btn) btn.disabled = false;
    });
  }

  bindEvolutionPhotoDeletes(client.id);
  bindCompararFotos(client.id);

  if (canEdit) {
    document.getElementById("btnEditarCliente")?.addEventListener("click", () => openEditModal(client));
  }

  document.getElementById("btnEnviarLinkCadastro")?.addEventListener("click", async () => {
    try {
      const { url } = await createClientPortalSession(client.id);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast("Link copiado! Envie para o cliente acessar o portal e completar o cadastro.");
      } else {
        prompt("Copie o link e envie para o cliente:", url);
        toast("Envie o link para o cliente acessar o portal.");
      }
    } catch (err) {
      console.error(err);
      const msg = err?.message || "Erro ao gerar link";
      const hint = (msg.includes("rota") || msg.includes("Servidor") || msg.includes("404")) ? " Tente novamente ou acesse Configurações." : "";
      toast(msg + hint, "error");
    }
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.add("hidden"));
      btn.classList.add("active");
      const paneId = tab === "dados" ? "tabDados" : tab === "historico" ? "tabHistorico" : tab === "protocolo" ? "tabProtocolo" : tab === "evolucao" ? "tabEvolucao" : tab === "pacotes" ? "tabPacotes" : "tabRotinaSkincare";
      const pane = document.getElementById(paneId);
      if (pane) pane.classList.remove("hidden");
    });
  });

  document.getElementById("btnProtocoloAddProduto")?.addEventListener("click", () => {
    const sel = document.getElementById("protocoloProdutoSelect");
    const qtyEl = document.getElementById("protocoloProdutoQty");
    const listEl = document.getElementById("protocoloProdutosList");
    const nome = (sel?.value || "").trim();
    if (!nome) {
      toast("Selecione um produto");
      return;
    }
    const qty = Math.max(0.01, parseFloat(qtyEl?.value) || 1);
    const li = document.createElement("li");
    li.className = "protocolo-produto-line";
    li.dataset.produto = nome;
    li.dataset.quantidade = String(qty);
    li.innerHTML = `<span>${escapeHtml(nome)} × ${qty}</span> <button type="button" class="btn-sm btn-remove-produto" title="Remover">×</button>`;
    li.querySelector(".btn-remove-produto")?.addEventListener("click", () => li.remove());
    listEl?.appendChild(li);
    sel.value = "";
    qtyEl.value = "1";
  });

  document.getElementById("btnRegistrarProtocolo")?.addEventListener("click", async () => {
    const protocoloId = document.getElementById("protocoloSelect")?.value?.trim() || null;
    const descricao = document.getElementById("protocoloDescricao")?.value?.trim() || "";
    const observacao = document.getElementById("protocoloObservacao")?.value?.trim() || "";
    const dataEl = document.getElementById("protocoloData");
    const aplicado_em = dataEl?.value ? `${dataEl.value}T12:00:00.000Z` : null;
    const produtosList = document.getElementById("protocoloProdutosList");
    const produtos_usados = [];
    produtosList?.querySelectorAll(".protocolo-produto-line").forEach((li) => {
      const nome = (li.dataset.produto || "").trim();
      if (nome) produtos_usados.push({ produto_nome: nome, quantidade: parseFloat(li.dataset.quantidade) || 1 });
    });
    if (!protocoloId && !descricao && produtos_usados.length === 0) {
      toast("Informe o que foi feito (descrição), adicione produtos ou selecione um protocolo.");
      return;
    }
    const agendaId = sessionStorage.getItem("clientePerfilAgendaId") || null;
    try {
      if (protocoloId) {
        const { alertas } = await getAlertaEstoqueProtocolo(protocoloId).catch(() => ({ alertas: [] }));
        if (alertas.length > 0) {
          const msg = alertas.map((a) => `${a.produto_nome} (precisa ${a.quantidade_necessaria}, saldo ${a.saldo_estimado})`).join("; ");
          toast(`Atenção: estoque baixo ou zerado — ${msg}`, "warning");
        }
      }
      await createProtocoloAplicado({
        clientId: client.id,
        protocoloId: protocoloId || undefined,
        agendaId: agendaId || undefined,
        observacao,
        descricao,
        aplicado_em: aplicado_em || undefined,
        produtos_usados,
      });
      if (agendaId) sessionStorage.removeItem("clientePerfilAgendaId");
      toast("Registro salvo no prontuário do paciente.");
      const [events, skincareRotina, protocolos, aplicados, registrosAnamnese, evolutionPhotos, proceduresList, resumoEstoque, cpfOther] = await Promise.all([
        getEventsByClient(client.id),
        getSkincareRotinaByClient(client.id).catch(() => null),
        getProtocolos(),
        getProtocolosAplicadosByClient(client.id),
        listRegistrosByClient(client.id).catch(() => []),
        listEvolutionPhotosByClient(client.id).catch(() => []),
        listProcedures(false).catch(() => []),
        getResumoPorProduto().catch(() => []),
        client.cpf ? getOtherClientWithSameCpf(client.cpf, client.id).catch(() => null) : Promise.resolve(null),
      ]);
      const produtosEstoque = (resumoEstoque || []).map((r) => (r.produto_nome || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
      renderPerfil(currentClient, events, canEditClient, skincareRotina, protocolos, aplicados, registrosAnamnese, evolutionPhotos, proceduresList, produtosEstoque, cpfOther);
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao registrar");
    }
  });

  if (canEdit) {
    document.getElementById("btnSalvarRotinaSkincare")?.addEventListener("click", async () => {
      const textarea = document.getElementById("skincareRotinaConteudo");
      const conteudo = textarea?.value?.trim() ?? "";
      try {
        await upsertSkincareRotina(client.id, { conteudo });
        toast("Rotina salva.");
        const [events, rotina, protocolos, aplicados, registrosAnamnese, evolutionPhotos, proceduresList, resumoEstoque, cpfOther] = await Promise.all([
          getEventsByClient(client.id),
          getSkincareRotinaByClient(client.id).catch(() => null),
          getProtocolos(),
          getProtocolosAplicadosByClient(client.id),
          listRegistrosByClient(client.id).catch(() => []),
          listEvolutionPhotosByClient(client.id).catch(() => []),
          listProcedures(false).catch(() => []),
          getResumoPorProduto().catch(() => []),
          client.cpf ? getOtherClientWithSameCpf(client.cpf, client.id).catch(() => null) : Promise.resolve(null),
        ]);
        const produtosEstoque = (resumoEstoque || []).map((r) => (r.produto_nome || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
        renderPerfil(currentClient, events, canEditClient, rotina, protocolos, aplicados, registrosAnamnese, evolutionPhotos, proceduresList, produtosEstoque, cpfOther);
      } catch (err) {
        console.error(err);
        toast(err?.message || "Erro ao salvar rotina");
      }
    });
    document.getElementById("btnLiberarRotinaSkincare")?.addEventListener("click", async () => {
      const textarea = document.getElementById("skincareRotinaConteudo");
      const conteudo = textarea?.value?.trim() ?? "";
      try {
        await upsertSkincareRotina(client.id, { conteudo, liberar: true });
        toast("Rotina liberada no portal. O cliente poderá ver no portal.");
        const [events, rotina, protocolos, aplicados, registrosAnamnese, evolutionPhotos, proceduresList, resumoEstoque, cpfOther] = await Promise.all([
          getEventsByClient(client.id),
          getSkincareRotinaByClient(client.id).catch(() => null),
          getProtocolos(),
          getProtocolosAplicadosByClient(client.id),
          listRegistrosByClient(client.id).catch(() => []),
          listEvolutionPhotosByClient(client.id).catch(() => []),
          listProcedures(false).catch(() => []),
          getResumoPorProduto().catch(() => []),
          client.cpf ? getOtherClientWithSameCpf(client.cpf, client.id).catch(() => null) : Promise.resolve(null),
        ]);
        const produtosEstoque = (resumoEstoque || []).map((r) => (r.produto_nome || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
        renderPerfil(currentClient, events, canEditClient, rotina, protocolos, aplicados, registrosAnamnese, evolutionPhotos, proceduresList, produtosEstoque, cpfOther);
      } catch (err) {
        console.error(err);
        toast(err?.message || "Erro ao liberar rotina");
      }
    });
    document.getElementById("btnGerarRotinaIA")?.addEventListener("click", () => {
      sessionStorage.setItem("skincare_client_id", client.id);
      sessionStorage.setItem("skincare_from_profile", "1");
      navigate("skincare");
    });
    document.getElementById("btnRegistrarEstudoCasoPerfil")?.addEventListener("click", async () => {
      const protocoloId = document.getElementById("protocoloSelect")?.value?.trim();
      const resposta = document.getElementById("estudoCasoRespostaPerfil")?.value?.trim();
      if (!protocoloId || !resposta) {
        toast("Selecione o protocolo e a resposta observada.");
        return;
      }
      try {
        await createEstudoCaso({
          protocoloId,
          tipo_pele: document.getElementById("estudoCasoTipoPelePerfil")?.value?.trim() || null,
          fototipo: document.getElementById("estudoCasoFototipoPerfil")?.value?.trim() || null,
          queixa_principal: document.getElementById("estudoCasoQueixaPerfil")?.value?.trim() || null,
          analise_pele_resumo: document.getElementById("estudoCasoAnalisePelePerfil")?.value?.trim() || null,
          resposta_observada: resposta,
          n_sessoes: document.getElementById("estudoCasoNSessoesPerfil")?.value?.trim() || null,
        });
        toast("Caso registrado (anonimizado). Veja em Estudo de caso no menu.");
        document.getElementById("estudoCasoRespostaPerfil").value = "";
        document.getElementById("estudoCasoTipoPelePerfil").value = "";
        document.getElementById("estudoCasoFototipoPerfil").value = "";
        document.getElementById("estudoCasoQueixaPerfil").value = "";
        document.getElementById("estudoCasoAnalisePelePerfil").value = "";
        document.getElementById("estudoCasoNSessoesPerfil").value = "";
      } catch (err) {
        toast(err?.message || "Erro ao registrar", "error");
      }
    });
  }

  document.querySelectorAll(".btn-state").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const newState = btn.dataset.state;
      if (!newState) return;
      try {
        await updateClientState(client.id, newState);
        await audit({
          action: "cliente.state_change",
          tableName: "clients",
          recordId: client.id,
          permissionUsed: editPermissionUsed,
          metadata: { new_state: newState },
        });
        toast("Estado atualizado");
        currentClient = await getClientById(client.id);
        const [events, skincareRotina, protocolos, aplicados, registrosAnamnese, evolutionPhotos, proceduresList, resumoEstoque, cpfOther] = await Promise.all([
          getEventsByClient(client.id),
          getSkincareRotinaByClient(client.id).catch(() => null),
          getProtocolos(),
          getProtocolosAplicadosByClient(client.id),
          listRegistrosByClient(client.id).catch(() => []),
          listEvolutionPhotosByClient(client.id).catch(() => []),
          listProcedures(false).catch(() => []),
          getResumoPorProduto().catch(() => []),
          currentClient.cpf ? getOtherClientWithSameCpf(currentClient.cpf, client.id).catch(() => null) : Promise.resolve(null),
        ]);
        const produtosEstoque = (resumoEstoque || []).map((r) => (r.produto_nome || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
        renderPerfil(currentClient, events, canEditClient, skincareRotina, protocolos, aplicados, registrosAnamnese, evolutionPhotos, proceduresList, produtosEstoque, cpfOther);
      } catch (err) {
        console.error(err);
        toast(err?.message || "Erro ao atualizar estado");
      }
    });
  });

  document.getElementById("btnRegistrarEvento")?.addEventListener("click", () => openEventModal(client));

  document.getElementById("btnCompararFotosEvolucao")?.addEventListener("click", () => openCompararFotosModal(client.id));
  document.getElementById("btnRelatorioEvolucao")?.addEventListener("click", () => openRelatorioEvolucaoModal(client));

  document.getElementById("btnEnviarLinkTermo")?.addEventListener("click", async () => {
    try {
      const { url } = await createClientPortalSession(client.id);
      const urlTermo = url.includes("?") ? `${url}&mode=consent` : `${url}?mode=consent`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(urlTermo);
        toast("Link copiado. Envie para o cliente assinar no aparelho dele; na página ele informará o nome por extenso e aceitará o termo.");
      } else {
        prompt("Copie o link e envie ao cliente para assinar o termo:", urlTermo);
      }
    } catch (e) {
      const msg = e?.message || "Erro ao gerar link";
      const hint = (msg.includes("rota") || msg.includes("Servidor") || msg.includes("404")) ? " Tente novamente ou acesse Configurações." : "";
      toast(msg + hint, "error");
    }
  });

  document.getElementById("btnRegistrarTermoPresencial")?.addEventListener("click", () => {
    openModal(
      "Assinatura presencial (neste aparelho)",
      `
      <p class="client-hint">O cliente está assinando agora neste aparelho. Peça o nome completo por extenso (como no documento) para dar respaldo ao termo.</p>
      <label>Nome do cliente por extenso <span class="required">*</span></label>
      <input type="text" id="termoPresencialNome" required placeholder="Ex.: Maria da Silva Santos" autocomplete="name">
      <label class="client-termo-check-inline">
        <input type="checkbox" id="termoPresencialImageUse">
        Cliente autorizou uso de imagem para divulgação (com anuência prévia para cada uso)
      </label>
      `,
      async () => {
        const nome = document.getElementById("termoPresencialNome")?.value?.trim();
        const imageUse = document.getElementById("termoPresencialImageUse")?.checked ?? false;
        if (!nome || nome.length < 3) {
          toast("Informe o nome completo por extenso.");
          return;
        }
        try {
          await updateClient(client.id, {
            consent_terms_accepted_at: new Date().toISOString(),
            consent_image_use: imageUse,
            consent_terms_version: "v1",
            consent_signed_name: nome,
            consent_signature_method: "presencial_digital",
          });
          closeModal();
          toast("Termo registrado (assinatura presencial).");
          currentClient = { ...currentClient, consent_terms_accepted_at: new Date().toISOString(), consent_image_use: imageUse, consent_terms_version: "v1", consent_signed_name: nome, consent_signature_method: "presencial_digital" };
          renderPerfil(currentClient, events, canEdit, skincareRotina, protocolos, protocolosAplicados, registrosAnamnese, cachedEvolutionPhotos, cachedProceduresList, cachedProdutosEstoque, null);
        } catch (e) {
          toast(e?.message || "Erro ao salvar");
        }
      }
    );
  });

  document.getElementById("btnRegistrarTermoPapel")?.addEventListener("click", () => {
    const today = new Date().toISOString().slice(0, 10);
    openModal(
      "Registrar aceite do termo (assinatura em papel)",
      `
      <p class="client-hint">Use quando o cliente assinar o termo em papel. A data será registrada.</p>
      <label>Data do aceite</label>
      <input type="date" id="termoConsentDate" value="${today}">
      <label class="client-termo-check-inline">
        <input type="checkbox" id="termoConsentImageUse">
        Cliente autorizou uso de imagem para divulgação (com anuência prévia para cada uso)
      </label>
      `,
      async () => {
        const dateVal = document.getElementById("termoConsentDate")?.value;
        const imageUse = document.getElementById("termoConsentImageUse")?.checked ?? false;
        const dateIso = dateVal ? new Date(dateVal + "T12:00:00").toISOString() : new Date().toISOString();
        try {
          await updateClient(client.id, {
            consent_terms_accepted_at: dateIso,
            consent_image_use: imageUse,
            consent_terms_version: "v1",
            consent_signature_method: "papel",
          });
          closeModal();
          toast("Termo registrado (em papel).");
          currentClient = { ...currentClient, consent_terms_accepted_at: dateIso, consent_image_use: imageUse, consent_terms_version: "v1", consent_signature_method: "papel" };
          renderPerfil(currentClient, events, canEdit, skincareRotina, protocolos, protocolosAplicados, registrosAnamnese, cachedEvolutionPhotos, cachedProceduresList, cachedProdutosEstoque, null);
        } catch (e) {
          toast(e?.message || "Erro ao salvar");
        }
      }
    );
  });
}

/** Encerra o hardware: para cada track do MediaStream (limpa trilhos). */
function fecharCameraEdit() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  const v = document.getElementById("editCameraVideo");
  if (v) v.srcObject = null;
  const area = document.getElementById("editClientesCameraArea");
  if (area) area.classList.add("hidden");
}

function openEditModal(client) {
  const cpfFormatted = formatCpfForInput(client.cpf || "");
  capturedPhotoDataUrl = null;
  capturedPhotoBlob = null;
  cameraStream = null;

  openModal(
    "Editar cliente",
    `
    <label>Foto (opcional)</label>
    <div class="clientes-foto-wrap">
      <input type="file" id="editClientPhoto" accept="image/jpeg,image/png,image/webp,image/gif" class="clientes-foto-input">
      <div class="clientes-foto-buttons">
        <button type="button" class="clientes-foto-btn" id="btnEditEscolherFoto">Escolher arquivo</button>
        <button type="button" class="clientes-foto-btn clientes-foto-btn-camera" id="btnEditTirarFoto">Tirar foto (câmera)</button>
      </div>
      <div class="clientes-camera-area hidden" id="editClientesCameraArea">
        <video id="editCameraVideo" class="clientes-camera-video" autoplay playsinline muted></video>
        <button type="button" class="clientes-foto-btn clientes-foto-btn-capture" id="btnEditCapturarFoto">Capturar foto</button>
      </div>
      <div class="clientes-foto-preview" id="editClientPhotoPreview">
        ${client.avatar_url ? `<img src="${escapeHtml(client.avatar_url)}" alt="Foto" class="clientes-foto-preview-img">` : ""}
      </div>
    </div>
    <label>Nome completo <span class="required">*</span></label>
    <input id="editName" required value="${escapeHtml(client.name || "")}" placeholder="Nome completo">
    <label>CPF</label>
    <input id="editCpf" type="text" value="${escapeHtml(cpfFormatted)}" placeholder="000.000.000-00" maxlength="14">
    <label>Telefone</label>
    <input id="editPhone" type="tel" value="${escapeHtml(client.phone || "")}" placeholder="(00) 00000-0000" maxlength="15">
    <label>E-mail</label>
    <input id="editEmail" type="email" value="${escapeHtml(client.email || "")}" placeholder="email@exemplo.com">
    <label>Data de nascimento</label>
    <input id="editBirthDate" type="date" value="${client.birth_date ? client.birth_date.slice(0, 10) : ""}">
    <label>Sexo</label>
    <select id="editSex">
      <option value="">—</option>
      <option value="F" ${client.sex === "F" ? "selected" : ""}>Feminino</option>
      <option value="M" ${client.sex === "M" ? "selected" : ""}>Masculino</option>
      <option value="Outro" ${client.sex === "Outro" ? "selected" : ""}>Outro</option>
    </select>
    <label>Observações</label>
    <textarea id="editNotes" rows="2" placeholder="Opcional">${escapeHtml(client.notes || "")}</textarea>
    <div class="cliente-modelo-option">
     <label><input type="checkbox" id="editIsPacienteModelo" ${client.is_paciente_modelo ? "checked" : ""}> Paciente modelo</label>
     <p class="cliente-modelo-hint">Ex.: modelo de botox; ao agendar será possível aplicar o desconto definido abaixo.</p>
     <label>Desconto modelo (%)</label>
     <input type="number" id="editModelDiscountPct" min="0" max="100" step="0.5" value="${client.model_discount_pct != null ? client.model_discount_pct : ""}" placeholder="Ex.: 30">
    </div>
  `,
    async () => {
      const name = document.getElementById("editName")?.value?.trim();
      const cpf = document.getElementById("editCpf")?.value?.trim() || null;
      const phone = document.getElementById("editPhone")?.value?.trim() || null;
      const email = document.getElementById("editEmail")?.value?.trim() || null;
      const birth_date = document.getElementById("editBirthDate")?.value || null;
      const sex = document.getElementById("editSex")?.value || null;
      const notes = document.getElementById("editNotes")?.value?.trim() || null;
      fecharCameraEdit();

      let photoFile = document.getElementById("editClientPhoto")?.files?.[0];
      if (!photoFile && capturedPhotoBlob && capturedPhotoBlob.size > 0) {
        photoFile = new File([capturedPhotoBlob], "avatar.jpg", { type: "image/jpeg" });
      }
      if (!photoFile && capturedPhotoDataUrl) {
        const blob = dataUrlToBlobSync(capturedPhotoDataUrl);
        if (blob && blob.size > 0) photoFile = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      }
      if (!photoFile) {
        const previewEl = document.getElementById("editClientPhotoPreview");
        const previewImg = previewEl?.querySelector("img");
        if (previewImg?.src) {
          try {
            const blob = previewImg.src.startsWith("data:")
              ? dataUrlToBlobSync(previewImg.src)
              : await fetch(previewImg.src).then((r) => r.blob());
            if (blob && blob.size > 0) photoFile = new File([blob], "avatar.jpg", { type: blob.type || "image/jpeg" });
          } catch (e) {
            console.warn("[Cliente perfil] Fallback preview→blob falhou:", e);
          }
        }
      }

      if (!name) {
        toast("Nome é obrigatório");
        return;
      }
      if (!phone && !email) {
        toast("Informe telefone ou e-mail");
        return;
      }

      const normalizedCpf = cpf ? cpf.replace(/\D/g, "") : null;
      if (normalizedCpf && normalizedCpf.length !== 11) {
        toast("CPF deve ter 11 dígitos");
        return;
      }

      try {
        const isPacienteModelo = document.getElementById("editIsPacienteModelo")?.checked ?? false;
        const modelDiscountPctRaw = document.getElementById("editModelDiscountPct")?.value?.trim();
        const model_discount_pct = (modelDiscountPctRaw !== "" && modelDiscountPctRaw != null) ? (parseFloat(modelDiscountPctRaw) || null) : null;

        const updates = {
          name,
          phone: phone || null,
          email: email || null,
          birth_date: birth_date || null,
          sex: sex || null,
          notes: notes || null,
          is_paciente_modelo: !!isPacienteModelo,
          model_discount_pct: model_discount_pct,
        };
        if (normalizedCpf !== undefined) updates.cpf = normalizedCpf || null;

        await updateClient(client.id, updates);

        if (photoFile) {
          const orgId = getActiveOrg();
          if (orgId) {
            try {
              const avatarUrl = await uploadClientPhoto(orgId, client.id, photoFile);
              if (avatarUrl) await updateClient(client.id, { avatar_url: avatarUrl });
            } catch (e) {
              console.warn("[Cliente perfil] Upload da foto falhou:", e);
              toast("Cliente atualizado, mas a foto não foi enviada. Verifique o bucket 'client-photos' e RLS no Supabase.");
            }
          }
        }

        await audit({
          action: "cliente.update",
          tableName: "clients",
          recordId: client.id,
          permissionUsed: editPermissionUsed,
          metadata: { client_name: name, fields_updated: Object.keys(updates) },
        });

        closeModal();
        toast("Cliente atualizado");
        currentClient = await getClientById(client.id);
        const [events, skincareRotina, protocolos, aplicados, registrosAnamnese, evolutionPhotos, proceduresList, resumoEstoque, cpfOther] = await Promise.all([
          getEventsByClient(client.id),
          getSkincareRotinaByClient(client.id).catch(() => null),
          getProtocolos(),
          getProtocolosAplicadosByClient(client.id),
          listRegistrosByClient(client.id).catch(() => []),
          listEvolutionPhotosByClient(client.id).catch(() => []),
          listProcedures(false).catch(() => []),
          getResumoPorProduto().catch(() => []),
          currentClient.cpf ? getOtherClientWithSameCpf(currentClient.cpf, client.id).catch(() => null) : Promise.resolve(null),
        ]);
        const produtosEstoque = (resumoEstoque || []).map((r) => (r.produto_nome || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
        renderPerfil(currentClient, events, canEditClient, skincareRotina, protocolos, aplicados, registrosAnamnese, evolutionPhotos, proceduresList, produtosEstoque, cpfOther);
      } catch (err) {
        console.error(err);
        toast(err?.message || "Erro ao atualizar cliente");
      }
    },
    fecharCameraEdit
  );

  const cpfInput = document.getElementById("editCpf");
  if (cpfInput) cpfInput.addEventListener("input", () => maskCpfInput(cpfInput));
  const phoneInput = document.getElementById("editPhone");
  if (phoneInput) {
    phoneInput.addEventListener("input", () => maskPhoneInput(phoneInput));
    maskPhoneInput(phoneInput); // formata valor inicial ao abrir o modal
  }

  const photoInput = document.getElementById("editClientPhoto");
  const btnFoto = document.getElementById("btnEditEscolherFoto");
  const btnTirar = document.getElementById("btnEditTirarFoto");
  const btnCapturar = document.getElementById("btnEditCapturarFoto");
  const preview = document.getElementById("editClientPhotoPreview");
  const cameraArea = document.getElementById("editClientesCameraArea");
  const videoEl = document.getElementById("editCameraVideo");

  if (btnFoto && photoInput) {
    btnFoto.addEventListener("click", () => photoInput.click());
    photoInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!preview) return;
      capturedPhotoDataUrl = null;
      capturedPhotoBlob = null;
      fecharCameraEdit();
      if (!file) return;
      const url = URL.createObjectURL(file);
      preview.innerHTML = `<img src="${url}" alt="Preview" class="clientes-foto-preview-img">`;
      btnFoto.textContent = "Trocar arquivo";
    });
  }
  if (btnTirar) {
    btnTirar.addEventListener("click", () => abrirCameraEdit());
  }
  if (btnCapturar) {
    btnCapturar.addEventListener("click", () => tirarFotoEdit());
  }

  async function abrirCameraEdit() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast("Câmera não disponível neste navegador.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      cameraStream = stream;
      if (!videoEl || !cameraArea) return;
      videoEl.srcObject = stream;
      await videoEl.play();
      cameraArea.classList.remove("hidden");
      const wrap = document.querySelector(".clientes-foto-wrap");
      if (wrap) wrap.classList.remove("is-capturing");
      if (preview) preview.innerHTML = "";
      if (photoInput) photoInput.value = "";
      if (btnFoto) btnFoto.textContent = "Escolher arquivo";
      // Garante que o vídeo e o botão "Capturar foto" fiquem visíveis no modal
      const btnCapturarEl = document.getElementById("btnEditCapturarFoto");
      requestAnimationFrame(() => {
        btnCapturarEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } catch (err) {
      console.warn("[Cliente perfil] Câmera:", err);
      toast("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  }

  function tirarFotoEdit() {
    const video = document.getElementById("editCameraVideo");
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast("Aguarde a câmera carregar.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 1. Congelar: Base64 no avatar de imediato (síncrono)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    capturedPhotoDataUrl = dataUrl;
    // Blob para upload já no momento da captura (síncrono) — garante uso no submit
    const blobSync = dataUrlToBlobSync(dataUrl);
    if (blobSync && blobSync.size > 0) {
      capturedPhotoBlob = blobSync;
    }
    if (preview) {
      preview.innerHTML = "";
      const img = document.createElement("img");
      img.alt = "Preview";
      img.className = "clientes-foto-preview-img";
      img.src = dataUrl;
      preview.appendChild(img);
    }
    // 2. Esconder vídeo e mostrar foto (estado visual)
    if (cameraArea) cameraArea.classList.add("hidden");
    const wrap = document.querySelector(".clientes-foto-wrap");
    if (wrap) wrap.classList.add("is-capturing");
    // 3. Limpa trilhos: desliga o hardware imediatamente após capturar
    fecharCameraEdit();
    if (btnFoto) btnFoto.textContent = "Trocar arquivo";
  }
}

function openEventModal(client) {
  openModal(
    "Registrar evento",
    `
    <label>Tipo</label>
    <input id="event_type" placeholder="ex: Consulta, Relato, Observação">
    <label>Descrição</label>
    <textarea id="event_description" rows="3" placeholder="Opcional"></textarea>
    <label>Data</label>
    <input id="event_date" type="date" value="${new Date().toISOString().slice(0, 10)}">
    <label><input type="checkbox" id="event_critical"> Evento crítico</label>
  `,
    async () => {
      const event_type = document.getElementById("event_type")?.value?.trim();
      const description = document.getElementById("event_description")?.value?.trim();
      const event_date = document.getElementById("event_date")?.value;
      const is_critical = document.getElementById("event_critical")?.checked;

      if (!event_type) {
        toast("Tipo do evento é obrigatório");
        return;
      }
      try {
        await createClientEvent({
          client_id: client.id,
          event_type,
          description: description || null,
          event_date: event_date || undefined,
          is_critical: !!is_critical,
        });
        closeModal();
        toast("Evento registrado");
        const events = await getEventsByClient(client.id);
        const ul = document.getElementById("clienteTimeline");
        if (ul) {
          ul.innerHTML = events.length
            ? events
                .map(
                  (e) => `
                <li class="timeline-item ${e.is_critical ? "timeline-critical" : ""}">
                  <span class="timeline-date">${formatDate(e.event_date)}</span>
                  <span class="timeline-type">${escapeHtml(e.event_type)}</span>
                  ${e.description ? `<p>${escapeHtml(e.description)}</p>` : ""}
                  ${e.created_by_client ? "<small>Relato do cliente</small>" : ""}
                </li>
              `
                )
                .join("")
            : "<li>Nenhum evento registrado.</li>";
        }
      } catch (err) {
        console.error(err);
        toast(err?.message || "Erro ao registrar evento");
      }
    }
  );
}
