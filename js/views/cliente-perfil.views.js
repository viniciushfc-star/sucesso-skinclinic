import { getClientById, getOtherClientWithSameCpf, updateClient, updateClientState, uploadClientPhoto, createClientPortalSession, applyRelacaoComercial, CLIENT_STATES } from "../services/clientes.service.js";
import { getEventsByClient, createClientEvent } from "../services/client-events.service.js";
import { getSkincareRotinaByClient, upsertSkincareRotina, liberarSkincareRotina } from "../services/skincare-rotina.service.js";
import { getProtocolos, getProtocolosAplicadosByClient, createProtocoloAplicado, getAlertaEstoqueProtocolo, getDescartaveisByProtocolo } from "../services/protocolo-db.service.js";
import { gerarProtocolo } from "../services/protocolo.service.js";
import {
  textoRascunhoLocal,
  produtosRascunhoLocal,
  textoRascunhoDeIa,
  payloadProtocoloIaFicha,
  temFonteParaIa,
  rotuloFonteIa,
} from "../utils/protocolo-rascunho-ficha.js";
import { getResumoPorProduto } from "../services/estoque-entradas.service.js";
import { createEstudoCaso } from "../services/estudo-caso.service.js";
import { listRegistrosByClient } from "../services/anamnesis.service.js";
import { listEvolutionPhotosByClient, addEvolutionPhoto, deleteEvolutionPhoto } from "../services/evolution-photos.service.js";
import { paresAntesDepois, indicesParPadrao, rotuloParEvolucao, ehDepois } from "../utils/antes-depois.js";
import { listAllProcedureStockUsage, listProcedures } from "../services/procedimentos.service.js";
import { custoRealFromUsage } from "../utils/estoque-custo.js";
import { listPacotesByClient, createPacote } from "../services/pacotes.service.js";
import { listOrcamentosByClient, createOrcamento, updateOrcamentoStatus, aceitarOrcamento } from "../services/orcamentos.service.js";
import { createAgendaSlots, getClientAgendaResumo } from "../services/appointments.service.js";
import { slotsAgendaDoAceite } from "../utils/ciclo-ouro.js";
import { listProdutosCatalogo } from "../services/estoque-produtos.service.js";
import { sendWhatsapp } from "../services/whatsapp.service.js";
import { getOrganizationProfile } from "../services/organization-profile.service.js";
import { getTaxas, getTaxaForParcelas, calcularLiquido } from "../services/precificacao-taxas.service.js";
import { formatOrcamentoMensagem, totalOrcamento, brl, statusOrcamentoLabel, linhaTotal, statusEfetivoOrcamento, isOrcamentoExpirado, payloadOrcamentoVisto, idsOrcamentosVistos, contarPacotesPorOrcamento } from "../utils/orcamento.js";
import { resumoMargemOrcamento, maxParcelasPreservandoLucro, custoUnitarioServico, textoParcelasSemJuros } from "../utils/orcamento-margem.js";
import { custoCatalogoComFrete } from "../utils/estoque-revenda.js";
import { compararPlanoVsAplicado } from "../utils/plano-vs-aplicado.js";
import { resumoCicloOuroFicha, proximaAcaoCicloFicha, aplicadoSemMaterial, sinaisInicioCiclo, linhaCicloOuroCabecalho } from "../utils/ciclo-ouro-ficha.js";
import { contextoFichaCopiloto } from "../utils/ficha-copiloto.js";
import { listPlanosDoCliente, listPlanosTerapeuticos } from "../services/planos-terapeuticos.service.js";
import { listAnalisesPeleByClient } from "../services/analise-pele.service.js";
import { getEntradasByAgendaId } from "../services/financeiro.service.js";
import { getTodayLocal } from "../services/metrics.service.js";
import { montarLinhaDoTempo } from "../utils/linha-tempo.js";
import { rotuloVersaoAnamnese } from "../utils/anamnese-versao.js";
import { compararEstoquePrevistoReal } from "../utils/estoque-previsto-real.js";
import { economiaSessaoPacote, textoEconomiaSessao } from "../utils/pacote-consumo-economia.js";
import { payloadCombinadoConsulta } from "../utils/consulta-combinado.js";
import { payloadPlanoFicha, mesclarPlanosFicha, jaCombinouPlano } from "../utils/plano-ficha.js";
import { mostrarLinkPortalCadastro } from "../utils/portal-link-cadastro.js";
import { payloadSilencio, mapaSilencioPorCliente, estaEmSilencio } from "../utils/whatsapp-regua.js";
import { audit } from "../services/audit.service.js";
import { exportTitularJson, eraseTitular } from "../services/lgpd.service.js";
import { isLgpdClientId } from "../utils/lgpd-titular.js";
import { checkPermission } from "../core/permissions.js";
import { getActiveOrg, getOrgMembers } from "../core/org.js";
import { openModal, closeModal, openConfirmModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { navigate } from "../core/spa.js";
import { relacaoComercialLabel } from "../utils/cliente-relacao.js";
import { bindCpfMask, bindPhoneMask } from "../utils/input-masks.js";
import {
  htmlEnderecoCliente,
  bindEnderecoCliente,
  readEnderecoCliente,
  htmlFotoCadastro,
  htmlClientAvatar,
  captureIds,
  wireFotoCadastro,
  photoFileFromCadastro,
} from "../utils/cliente-cadastro.js";
import { MAPAS, PRODUTOS_APLICACAO, pontoStatus } from "../utils/injetaveis-mapas.js";
import { bindMapa3d, htmlToolbarMapa3d } from "../utils/mapa-3d.js";

let orcamentoTaxasCtx = {};

let currentClient = null;
/** Registros de anamnese injetáveis (rosto_injetaveis) para abrir o mapa pelo id */
let cachedRegistrosInjetaveis = [];
/** Stream da câmera no modal de editar cliente */
let fotoCadastroState = { stream: null, blob: null, dataUrl: null };
let fotoCadastroIds = captureIds("editClient");
let fotoCadastroWire = null;
/** Se o usuário pode editar cliente (usado no callback do modal após salvar) */
let canEditClient = false;
/** Portabilidade / exclusão LGPD (clientes:manage) */
let canLgpdClient = false;

let editPermissionUsed = "clientes:manage"; // qual permissão usar na auditoria (manage ou edit)
let cachedProceduresList = [];
let cachedEvolutionPhotos = [];
let cachedProdutosEstoque = [];
let cachedPlanosCliente = [];
let cachedPlanosCatalogo = [];
let cachedCanAgendar = false;
let cachedCanCriarPlano = false;
let cachedCanIaAssist = false;
let cachedCanCopilot = false;
let cachedProtocolosFicha = [];
let cachedAplicadosFicha = [];
let cachedCicloFicha = { pacotes: [], anamnese: [], analises: [], lancamentos: [], temAgendaFutura: false };

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
    const [events, skincareRotina, protocolos, protocolosAplicados, registrosAnamnese, evolutionPhotos, proceduresList, resumoEstoque, cpfOther, pacotes, orcamentos, taxasOrg, planosAgenda, planosCatalogo, analisesPele] = await Promise.all([
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
      listOrcamentosByClient(clientId).catch(() => []),
      getTaxas().catch(() => ({})),
      listPlanosDoCliente(clientId).catch(() => []),
      listPlanosTerapeuticos().catch(() => []),
      listAnalisesPeleByClient(clientId).catch(() => []),
    ]);
    cachedPlanosCatalogo = planosCatalogo || [];
    const planosCliente = mesclarPlanosFicha(planosAgenda, events, planosCatalogo);
    cachedPlanosCliente = planosCliente || [];
    const agendaIds = [...new Set((protocolosAplicados || []).map((a) => a.agenda_id).filter(Boolean))];
    const [lancamentosNested, resumoAgenda] = await Promise.all([
      Promise.all(agendaIds.map((id) => getEntradasByAgendaId(id).then((rows) => (rows || []).map((r) => ({ ...r, agenda_id: id }))))),
      getClientAgendaResumo(clientId, agendaIds[0] || "").catch(() => ({ temFuturo: false })),
    ]);
    cachedCicloFicha = {
      pacotes: pacotes || [],
      anamnese: registrosAnamnese || [],
      analises: analisesPele || [],
      lancamentos: lancamentosNested.flat(),
      temAgendaFutura: !!resumoAgenda?.temFuturo,
      events: events || [],
    };
    const produtosEstoque = (resumoEstoque || []).map((r) => (r.produto_nome || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
    const protoIds = [...new Set((protocolosAplicados || []).map((a) => a.protocolo_id).filter(Boolean))];
    const previstosEntries = await Promise.all(
      protoIds.map(async (id) => [id, await getDescartaveisByProtocolo(id).catch(() => [])])
    );
    const previstosById = Object.fromEntries(previstosEntries);
    for (const a of protocolosAplicados || []) {
      a._previsto = a.protocolo_id ? previstosById[a.protocolo_id] || [] : [];
    }
    const canManage = await checkPermission("clientes:manage");
    const canEditPerm = await checkPermission("clientes:edit");
    canEditClient = canManage || canEditPerm;
    canLgpdClient = canManage;
    editPermissionUsed = canManage ? "clientes:manage" : "clientes:edit";
    cachedCanAgendar = await checkPermission("agenda:manage").catch(() => false);
    cachedCanCriarPlano = await checkPermission("procedimentos:view").catch(() => false);
    cachedCanIaAssist = await checkPermission("ia:assist").catch(() => false);
    cachedCanCopilot =
      (await checkPermission("ia:copilot").catch(() => false)) ||
      (await checkPermission("ia:assist").catch(() => false));
    cachedProtocolosFicha = protocolos || [];
    cachedAplicadosFicha = protocolosAplicados || [];
    renderPerfil(currentClient, events, canEditClient, skincareRotina, protocolos, protocolosAplicados, registrosAnamnese, evolutionPhotos, proceduresList, produtosEstoque, cpfOther, pacotes, orcamentos, taxasOrg);
    if (sessionStorage.getItem("clientePerfilOpenEdit") === "1") {
      sessionStorage.removeItem("clientePerfilOpenEdit");
      if (canEditClient) setTimeout(() => openEditModal(currentClient), 100);
    }
    const openTab = sessionStorage.getItem("clientePerfilOpenTab");
    if (openTab) {
      sessionStorage.removeItem("clientePerfilOpenTab");
      document.querySelector(`.tab-btn[data-tab="${openTab}"]`)?.click();
    }
    const focusOrc = sessionStorage.getItem("clientePerfilOrcamentoId");
    if (focusOrc) {
      sessionStorage.removeItem("clientePerfilOrcamentoId");
      const el = document.querySelector(`.cliente-orcamento-item[data-id="${CSS.escape(focusOrc)}"]`);
      if (el) {
        el.classList.add("cliente-orcamento-item--focus");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
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

function renderLgpdBlock(client) {
  if (!canLgpdClient) return "";
  const erased = !!(client.lgpd_erased_at || client.name === "Titular excluído");
  const canonical = isLgpdClientId(client.id);
  if (!canonical) {
    return `<div class="cliente-lgpd-block">
      <h4>Dados e privacidade</h4>
      <p class="client-hint">Este cadastro ainda está só na tabela antiga. A portabilidade e a exclusão do titular valem no cadastro unificado (UUID).</p>
    </div>`;
  }
  if (erased) {
    return `<div class="cliente-lgpd-block">
      <h4>Dados e privacidade</h4>
      <p class="client-hint">Identidade anonimizada. O prontuário (o que foi feito na clínica) permanece para respaldo em intercorrência.</p>
    </div>`;
  }
  return `<div class="cliente-lgpd-block">
    <h4>Dados e privacidade</h4>
    <p class="client-hint">Pedido do titular: exportar o que a clínica guarda ou remover nome, contato e CPF. <strong>O prontuário não some</strong> (anamnese, fotos, protocolos, agenda e financeiro) — respaldo se houver intercorrência. <strong>Não é parecer jurídico.</strong> Rascunho interno de IA não entra no arquivo.</p>
    <div class="cliente-consent-actions">
      <button type="button" class="btn-secondary btn-sm" id="btnLgpdExport">Exportar dados do titular (JSON)</button>
      <button type="button" class="btn-secondary btn-sm" id="btnLgpdErase">Anonimizar identidade (manter prontuário)</button>
    </div>
  </div>`;
}

function renderPerfil(client, events, canEdit = false, skincareRotina = null, protocolos = [], protocolosAplicados = [], registrosAnamnese = [], evolutionPhotos = [], proceduresList = [], produtosEstoque = [], cpfOther = null, pacotes = [], orcamentos = [], taxasOrg = {}) {
  const container = document.getElementById("clientePerfilContent");
  if (!container) return;
  cachedProceduresList = proceduresList || [];
  cachedEvolutionPhotos = evolutionPhotos || [];
  cachedProdutosEstoque = produtosEstoque || [];
  const rotinaConteudo = skincareRotina?.conteudo ?? "";
  const rotinaLiberada = !!skincareRotina?.liberado_em;
  const rotinaUpdated = skincareRotina?.updated_at;

  container.innerHTML = `
    <div class="cliente-perfil">
      <div class="cliente-perfil-header">
        <div class="cliente-perfil-header-left">
          ${htmlClientAvatar(client.avatar_url, client.name, "clientes-avatar-wrap--perfil")}
          <div class="cliente-perfil-title">
            <button type="button" class="btn-back" id="btnVoltarClientes" title="Voltar">← Voltar</button>
            <h2>${escapeHtml(client.name)}</h2>
            <p class="cliente-perfil-meta">
              <span class="cliente-state-badge cliente-state-${(client.state || client.status || "").replace("_", "-")}">${stateLabel(client.state || client.status)}</span>
              <span class="clientes-relacao clientes-relacao-${escapeHtml(client.relacao_comercial || "none")}">${escapeHtml(relacaoComercialLabel(client.relacao_comercial))}</span>
              ${client.phone ? ` · ${escapeHtml(client.phone)}` : ""}
              ${client.email ? ` · ${escapeHtml(client.email)}` : ""}
            </p>
            ${registrosAnamnese.length ? `<p class="cliente-perfil-anamnese-meta">Anamnese salva · Última: ${escapeHtml((registrosAnamnese[0].created_at ? new Date(registrosAnamnese[0].created_at).toLocaleDateString("pt-BR") : "—"))}</p>` : ""}
            ${renderCicloLinhaCabecalho(cachedPlanosCliente, protocolos, protocolosAplicados, cachedCicloFicha)}
          </div>
        </div>
        <div class="cliente-perfil-actions">
          <div class="cliente-perfil-actions-main">
            <button type="button" class="btn-primary" id="btnAnamneseCliente" title="Ficha de anamnese e análise de caso">Anamnese</button>
            <button type="button" class="btn-secondary" id="btnAgendarCliente" title="Abrir a agenda com esta pessoa">Agendar</button>
            ${canEdit ? '<button type="button" class="btn-secondary" id="btnEditarCliente">Editar</button>' : ""}
          </div>
          <div class="cliente-perfil-actions-more">
          <button type="button" class="btn-secondary btn-sm" id="btnWhatsappSilencio">${estaEmSilencio(mapaSilencioPorCliente(events || [], new Date().toISOString().slice(0, 10)), client.id) ? "Liberar WhatsApp" : "Silêncio no WhatsApp"}</button>
          ${canEdit ? `
            <button type="button" class="btn-secondary btn-sm" id="btnEnviarLinkCadastro">Link do portal</button>
          ` : ""}
          ${(client.state || client.status) === "arquivado" && canEdit ? `
            <button type="button" class="btn-secondary btn-sm btn-state" data-state="em_acompanhamento">Retornar ao tratamento</button>
          ` : ""}
          ${(client.state || client.status) === "pausado" && canEdit ? `
            <button type="button" class="btn-secondary btn-sm btn-state" data-state="em_acompanhamento">Retornar ao acompanhamento</button>
          ` : ""}
          ${canChangeState(client) ? `
            <button type="button" class="btn-secondary btn-sm btn-state" data-state="pausado" ${(client.state || client.status) === "pausado" ? "disabled" : ""}>Pausar</button>
            <button type="button" class="btn-secondary btn-sm btn-state" data-state="alta" ${(client.state || client.status) === "alta" ? "disabled" : ""}>Dar alta</button>
            <button type="button" class="btn-secondary btn-sm btn-state btn-archive" data-state="arquivado">Arquivar</button>
          ` : ""}
          </div>
        </div>
      </div>

      <div class="cliente-perfil-tabs">
        <button type="button" class="tab-btn active" data-tab="dados">Dados</button>
        <button type="button" class="tab-btn" data-tab="historico">Histórico</button>
        <button type="button" class="tab-btn" data-tab="protocolo">Protocolo</button>
        <details class="perfil-tabs-mais">
          <summary>Mais</summary>
          <button type="button" class="tab-btn" data-tab="evolucao">Evolução</button>
          <button type="button" class="tab-btn" data-tab="rotina-skincare">Skincare</button>
          <button type="button" class="tab-btn" data-tab="pacotes">Pacotes</button>
          <button type="button" class="tab-btn" data-tab="orcamentos">Orçamentos</button>
        </details>
      </div>

      <div id="tabDados" class="tab-pane active">
        <div class="cliente-dados">
          <p class="cliente-perfil-anamnese-link"><button type="button" class="btn-link btn-open-anamnese" title="Abrir ficha de anamnese e evolução">Abrir anamnese</button> · <button type="button" class="btn-link" id="btnAgendarClienteDados" title="Abrir a agenda com esta pessoa">Agendar horário</button> · <button type="button" class="btn-link" id="btnPerfilIrOrcamento">Orçamento</button></p>
          ${renderCicloOuroFichaDados(cachedPlanosCliente, protocolos, protocolosAplicados, cachedCicloFicha)}
          ${cpfOther ? `<div class="form-warning cliente-cpf-duplicado-aviso" role="alert"><strong>Atenção:</strong> Outro cliente nesta organização possui o mesmo CPF: ${escapeHtml(cpfOther.name || "cliente cadastrado")}. Revise os cadastros para evitar duplicidade.</div>` : ""}
          <p><strong>Nome:</strong> ${escapeHtml(client.name)} ${client.is_paciente_modelo ? '<span class="cliente-badge-modelo">Paciente modelo</span>' : ""}</p>
          ${client.is_paciente_modelo && client.model_discount_pct != null ? `<p><strong>Desconto modelo:</strong> ${Number(client.model_discount_pct)}%</p>` : ""}
          <p><strong>Contato:</strong> ${escapeHtml(client.phone || "—")} / ${escapeHtml(client.email || "—")}</p>
          ${client.cpf ? `<p><strong>CPF:</strong> ${formatCpfForInput(client.cpf)}</p>` : ""}
          ${client.cep || client.endereco || client.cidade ? `<p><strong>Endereço:</strong> ${escapeHtml([client.endereco, client.complemento, client.cidade, client.estado, client.cep].filter(Boolean).join(" · ") || "—")}</p>` : ""}
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
          ${renderLgpdBlock(client)}
        </div>
      </div>

      <div id="tabHistorico" class="tab-pane hidden">
        <div class="cliente-historico">
          <p class="cliente-perfil-anamnese-link"><button type="button" class="btn-link btn-open-anamnese" title="Abrir ficha de anamnese e evolução">Abrir anamnese</button></p>
          <button type="button" class="btn-primary" id="btnRegistrarEvento">Registrar evento</button>
          <button type="button" class="btn-secondary" id="btnRegistrarCombinado">Combinado da consulta</button>
          <div class="timeline-filtros" role="tablist" aria-label="Origem da linha do tempo">
            <button type="button" class="timeline-filtro is-active" data-filtro="todos">Todos</button>
            <button type="button" class="timeline-filtro" data-filtro="interno">Interno</button>
            <button type="button" class="timeline-filtro" data-filtro="portal">Portal</button>
          </div>
          <ul class="timeline" id="clienteTimeline">
            ${renderLinhaDoTempoUnificada(events, registrosAnamnese, protocolosAplicados, orcamentos, pacotes)}
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
            <p class="client-hint">Tire o <strong>antes</strong> na consulta e o <strong>depois</strong> na sessão seguinte, no mesmo procedimento. O par aparece sozinho. Comparar não publica em rede.</p>
            <div id="clienteEvolutionPhotosPares" class="antes-depois-pares">${renderParesAntesDepois(evolutionPhotos, proceduresList)}</div>
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
              <label>Procedimento (mesmo no antes e no depois)</label>
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
          <p class="client-hint">Registre o que foi feito no atendimento: descrição, produtos usados (do estoque) e, se quiser, um protocolo cadastrado. O registro fica ligado ao prontuário e à data. Plano é o combinado; protocolo é a receita; aplicado é o feito. O sistema não troca um pelo outro.</p>
          ${renderCicloOuroFicha(cachedPlanosCliente, protocolos, protocolosAplicados, cachedCicloFicha)}
          ${renderDivergenciaPlanoAplicado(pacotes, protocolosAplicados, cachedPlanosCliente)}
          <div class="protocolo-registro-form">
            <label for="protocoloData">Data do atendimento</label>
            <input type="date" id="protocoloData" value="${(function(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");})()}">
            <label for="protocoloDescricao">O que foi feito</label>
            <textarea id="protocoloDescricao" rows="3" placeholder="Ex.: Limpeza de pele, aplicação de toxina na região frontal, peelings..."></textarea>
            <div class="protocolo-feito-ia">
            <div class="protocolo-rascunho-acoes">
              <button type="button" class="btn-secondary btn-sm" id="btnProtocoloRascunho">Sugerir rascunho</button>
              ${cachedCanIaAssist ? `<button type="button" class="btn-secondary btn-sm" id="btnProtocoloRascunhoIa">Sugerir com IA</button>` : ""}
              <p class="client-hint">A IA sugere aqui. Só entra no campo se você clicar em Usar. Registrar continua com você. Não grava sozinho, não muda preço, não baixa estoque.</p>
            </div>
            <div id="protocoloIaPreview" class="protocolo-ia-preview hidden" hidden>
              <p class="protocolo-ia-preview__label">Sugestão da IA — não gravada</p>
              <p class="protocolo-ia-preview__fonte" id="protocoloIaFonte"></p>
              <pre id="protocoloIaTexto" class="protocolo-ia-preview__texto"></pre>
              <div class="protocolo-ia-preview__acoes">
                <button type="button" class="btn-primary btn-sm" id="btnProtocoloIaUsar">Usar no campo</button>
                <button type="button" class="btn-secondary btn-sm" id="btnProtocoloIaDescartar">Descartar</button>
              </div>
            </div>
            </div>
            <div class="protocolo-produtos-wrap">
              <label>Produtos utilizados (estoque)</label>
              <p class="client-hint protocolo-produtos-hint">O que você listar é o consumo real. Se escolher um protocolo e não listar o item, o estoque assume o descartável cadastrado. O atendimento não trava.</p>
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
          <p class="client-hint cliente-evolucao-aba-hint">Mostre o par na consulta. Relatório imprime se o cliente autorizar a imagem. O sistema não posta sozinho.</p>
          <div class="cliente-evolucao-aba-actions">
            ${(evolutionPhotos || []).length >= 2 ? `<button type="button" class="btn-primary" id="btnCompararFotosEvolucao">Comparar fotos</button>` : ""}
            <button type="button" class="btn-secondary" id="btnRelatorioEvolucao">Relatório antes/depois</button>
            <button type="button" class="btn-link" id="btnIrFotosHistorico">Adicionar foto no Histórico</button>
          </div>
          <div class="cliente-evolucao-aba-galeria">
            <h4 class="cliente-evolucao-title">Pares na ficha</h4>
            <div id="clienteEvolutionPhotosParesEvolucao" class="antes-depois-pares">${renderParesAntesDepois(evolutionPhotos, proceduresList)}</div>
            <h4 class="cliente-evolucao-title">Ainda sem par</h4>
            <div id="clienteEvolutionPhotosListEvolucao" class="cliente-evolucao-fotos-list">
              ${renderEvolutionPhotosSoltas(evolutionPhotos, proceduresList)}
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
          <p class="client-hint">Pacotes de sessões vendidos a este cliente. Dê baixa ao concluir cada atendimento (na Agenda, ao dar baixa no agendamento, ou manualmente aqui). Custo e margem da sessão são estimativa; o preço do catálogo não muda.</p>
          ${canEdit ? `<button type="button" class="btn-primary" id="btnVenderPacote">+ Vender pacote</button>` : ""}
          <ul id="clientePacotesList" class="cliente-pacotes-list">
            ${(pacotes || []).length ? (pacotes || []).map((p) => {
              const restantes = p.sessoes_restantes ?? Math.max(0, (p.total_sessoes ?? 0) - (p.sessoes_utilizadas ?? 0));
              const valido = !p.valido_ate || new Date(p.valido_ate) >= new Date();
              const eco = economiaSessaoPacote({
                valorPagoPacote: p.valor_pago,
                totalSessoes: p.total_sessoes,
                custoMaterialSessao: p.custo_material_estimado,
                comissaoPct: p.comissao_profissional_pct,
                margemAlvoPct: p.margem_minima_desejada,
              });
              const ecoCls = eco.abaixoAlvo ? " cliente-pacote-economia--alerta" : "";
              return `<li class="cliente-pacote-item ${restantes === 0 ? "cliente-pacote-esgotado" : ""} ${!valido ? "cliente-pacote-vencido" : ""}" data-package-id="${p.id}">
                <span class="cliente-pacote-nome">${escapeHtml(p.nome_pacote)}</span>
                ${p.procedure_name ? `<span class="cliente-pacote-proc">${escapeHtml(p.procedure_name)}</span>` : ""}
                <span class="cliente-pacote-sessoes">${p.sessoes_utilizadas ?? 0} / ${p.total_sessoes ?? 0} sessões</span>
                ${restantes > 0 && valido ? `<span class="cliente-pacote-restantes">${restantes} restantes</span>` : ""}
                ${p.valido_ate ? `<span class="cliente-pacote-valido">Válido até ${formatDate(p.valido_ate)}</span>` : ""}
                ${p.valor_pago != null ? `<span class="cliente-pacote-valor">R$ ${Number(p.valor_pago).toFixed(2).replace(".", ",")}</span>` : ""}
                <span class="cliente-pacote-economia${ecoCls}">${escapeHtml(textoEconomiaSessao(eco))}</span>
              </li>`;
            }).join("") : "<li class=\"cliente-pacotes-empty\">Nenhum pacote. Clique em \"Vender pacote\" para registrar.</li>"}
          </ul>
        </div>
      </div>

      <div id="tabOrcamentos" class="tab-pane hidden">
        <div class="cliente-orcamentos">
          <p class="client-hint">Monte a proposta, envie no WhatsApp (um paciente por vez) e, se fechar, grave no cadastro. Não altera o preço do catálogo.</p>
          ${canEdit ? `<button type="button" class="btn-primary" id="btnNovoOrcamento">+ Novo orçamento</button>` : ""}
          <ul id="clienteOrcamentosList" class="cliente-orcamentos-list">
            ${renderOrcamentosList(orcamentos, canEdit, { events, pacotes, taxas: taxasOrg })}
          </ul>
        </div>
      </div>
    </div>
  `;

  bindPerfilEvents(client, canEdit, proceduresList, orcamentos);
}

function renderLinhaDoTempoUnificada(events, anamnese, aplicados, orcamentos, pacotes) {
  const items = montarLinhaDoTempo({ events, anamnese, aplicados, orcamentos, pacotes });
  if (!items.length) {
    return "<li>Nada na linha do tempo ainda. Eventos, anamnese, o que foi aplicado e orçamentos aparecem aqui.</li>";
  }
  return items
    .map((e) => {
      const visLabel = e.visibilidade === "portal" ? "Portal" : "Interno";
      return `<li class="timeline-item ${e.critico ? "timeline-critical" : ""}" data-vis="${escapeHtml(e.visibilidade)}">
        <span class="timeline-date">${formatDate(e.date)}</span>
        <span class="timeline-type">${escapeHtml(e.titulo)}</span>
        <span class="timeline-vis timeline-vis--${escapeHtml(e.visibilidade)}">${visLabel}</span>
        ${e.detalhe ? `<p>${escapeHtml(e.detalhe)}</p>` : ""}
      </li>`;
    })
    .join("");
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
      const prods = Array.isArray(a.produtos_usados) ? a.produtos_usados.map((p) => p.produto_nome).filter(Boolean).slice(0, 3).join(", ") : "";
      const extra = prods || (a.descricao || "").trim().slice(0, 50);
      return `<span class="prontuario-data-badge prontuario-data-badge--protocolo">${escapeHtml(nome)}${extra ? " — " + escapeHtml(extra) + (extra.length >= 50 ? "…" : "") : ""}</span>`;
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

function htmlCicloOuroCols(resumo) {
  return (resumo.colunas || [])
    .map((c) => {
      const corpo = c.itens.length
        ? `<ul>${c.itens.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
        : `<p class="ciclo-ouro-ficha__empty">${escapeHtml(c.vazio)}</p>`;
      return `<div class="ciclo-ouro-ficha__col" data-ciclo="${escapeHtml(c.id)}"><p class="ciclo-ouro-ficha__label">${escapeHtml(c.titulo)}</p>${corpo}</div>`;
    })
    .join("");
}

function htmlCicloOuroSinais(extra = {}) {
  const sinais = sinaisInicioCiclo({ anamnese: extra.anamnese, analises: extra.analises });
  return `<p class="ciclo-ouro-ficha__sinais" aria-label="Início do ciclo">
    <span class="${sinais.anamneseOk ? "ciclo-ouro-ficha__chip" : "ciclo-ouro-ficha__chip ciclo-ouro-ficha__chip--pendente"}">${escapeHtml(sinais.anamnese)}</span>
    <span class="${sinais.peleOk ? "ciclo-ouro-ficha__chip" : "ciclo-ouro-ficha__chip ciclo-ouro-ficha__chip--pendente"}">${escapeHtml(sinais.pele)}</span>
  </p>`;
}

function renderCicloLinhaCabecalho(planosCliente, protocolos, aplicados, extra = {}) {
  const linha = linhaCicloOuroCabecalho(
    resumoCicloOuroFicha({ planosCliente, protocolos, aplicados, pacotes: extra.pacotes || [] })
  );
  return `<p class="cliente-perfil-ciclo-linha">Combinado: ${escapeHtml(linha.combinado)} · Receita: ${escapeHtml(linha.receita)} · Feito: ${escapeHtml(linha.feito)}</p>`;
}

function renderCicloOuroFichaDados(planosCliente, protocolos, aplicados, extra = {}) {
  const resumo = resumoCicloOuroFicha({
    planosCliente,
    protocolos,
    aplicados,
    pacotes: extra.pacotes || [],
  });
  return `<section class="ciclo-ouro-ficha-wrap ciclo-ouro-ficha-wrap--dados" aria-label="Plano, protocolo e o que foi aplicado">
    <div class="ciclo-ouro-ficha-head">
      <h3 class="ciclo-ouro-ficha-title">Neste paciente</h3>
      <div class="ciclo-ouro-ficha-head-acoes">
      ${cachedCanCopilot ? `<button type="button" class="btn-secondary btn-sm btn-ficha-explicar">Explicar esta ficha</button>` : ""}
      <button type="button" class="btn-link" id="btnCicloVerProtocolo">Registrar feito</button>
      <button type="button" class="btn-link" id="btnCicloVerEvolucao">Antes/depois</button>
      </div>
    </div>
    ${htmlResumoParesFicha(cachedEvolutionPhotos)}
    ${htmlCicloOuroSinais(extra)}
    <div class="ciclo-ouro-ficha" role="region">${htmlCicloOuroCols(resumo)}</div>
    <p class="client-hint">Plano é o combinado; protocolo é a receita; aplicado é o feito. O sistema não troca um pelo outro.</p>
  </section>`;
}

function renderCicloOuroFicha(planosCliente, protocolos, aplicados, extra = {}) {
  const pacotes = extra.pacotes || [];
  const resumo = resumoCicloOuroFicha({ planosCliente, protocolos, aplicados, pacotes });
  const avisoMaterial = aplicadoSemMaterial(aplicados)
    ? `<p class="ciclo-ouro-ficha__aviso" role="status">Há registro feito sem produto de estoque. O atendimento não trava; confira se a baixa de material ficou de fora.</p>`
    : "";
  const prox = proximaAcaoCicloFicha({
    planosCliente,
    pacotes,
    aplicados,
    lancamentos: extra.lancamentos || [],
    temAgendaFutura: !!extra.temAgendaFutura,
    today: getTodayLocal(),
  });
  const cols = htmlCicloOuroCols(resumo);
  const catalogo = cachedPlanosCatalogo || [];
  const preferido = (planosCliente || []).find((p) => p.id)?.id || catalogo[0]?.id || "";
  let acao = "";
  if (prox.tipo === "registrar" && cachedCanAgendar && prox.agendaId) {
    const quando = [prox.data, String(prox.hora || "").slice(0, 5)].filter(Boolean).join(" ");
    acao = `<div class="ciclo-ouro-ficha__acao">
      <button type="button" class="btn-primary btn-sm" id="btnCicloRegistrarAplicado" data-agenda-id="${escapeHtml(prox.agendaId)}">Registrar o que foi aplicado${quando ? ` (${escapeHtml(quando)})` : ""}</button>
    </div>`;
  } else if (prox.tipo === "baixa" && cachedCanAgendar && prox.agendaId) {
    acao = `<div class="ciclo-ouro-ficha__acao">
      <button type="button" class="btn-primary btn-sm" id="btnCicloDarBaixa" data-agenda-id="${escapeHtml(prox.agendaId)}">Conferir baixa no horário</button>
      <p class="ciclo-ouro-ficha__empty">Não lança pagamento sozinho. Abre o horário para você conferir o recebido.</p>
    </div>`;
  } else if (prox.tipo === "proxima" && cachedCanAgendar) {
    acao = `<div class="ciclo-ouro-ficha__acao">
      <p class="ciclo-ouro-ficha__empty">${escapeHtml(prox.titulo || "Ainda há sessão do pacote.")} WhatsApp não sai daqui.</p>
      <button type="button" class="btn-primary btn-sm" id="btnCicloProximaSessao" data-date="${escapeHtml(prox.dataSugerida || "")}">Agendar próxima sessão</button>
    </div>`;
  } else if (cachedCanAgendar && catalogo.length) {
    const opts = catalogo
      .map((p) => `<option value="${escapeHtml(p.id)}"${p.id === preferido ? " selected" : ""}>${escapeHtml(p.nome || "Plano")}</option>`)
      .join("");
    acao = `<div class="ciclo-ouro-ficha__acao">
      <label for="cicloAgendarPlanoSelect">Plano combinado</label>
      <select id="cicloAgendarPlanoSelect">${opts}</select>
      <button type="button" class="btn-secondary btn-sm" id="btnCicloCombinarPlano">Combinar na ficha</button>
      <button type="button" class="btn-primary btn-sm" id="btnCicloAgendarPlano">Agendar com plano</button>
      <p class="ciclo-ouro-ficha__empty">Combinar não marca horário. Agendar já leva o plano para a grade.</p>
    </div>`;
  } else if (cachedCanCriarPlano && !catalogo.length) {
    acao = `<div class="ciclo-ouro-ficha__acao">
      <p class="ciclo-ouro-ficha__empty">Ainda não há plano no catálogo. Crie um em Procedimentos e volte para agendar.</p>
      <button type="button" class="btn-secondary btn-sm" id="btnCicloCriarPlano">Criar plano terapêutico</button>
    </div>`;
  } else if (cachedCanAgendar && !catalogo.length) {
    acao = `<p class="ciclo-ouro-ficha__empty">Peça à gestão um plano em Procedimentos. Depois agende por aqui.</p>`;
  }
  const explicar = cachedCanCopilot
    ? `<div class="ciclo-ouro-ficha__acao"><button type="button" class="btn-secondary btn-sm btn-ficha-explicar">Explicar esta ficha</button><p class="ciclo-ouro-ficha__empty">A IA explica o ciclo. Não grava, não muda preço, não manda WhatsApp.</p></div>`
    : "";
  return `${htmlCicloOuroSinais(extra)}<div class="ciclo-ouro-ficha" role="region" aria-label="Plano, protocolo e o que foi aplicado">${cols}</div>${avisoMaterial}${acao}${explicar}`;
}

function renderDivergenciaPlanoAplicado(pacotes, aplicados, planos = []) {
  const cmp = compararPlanoVsAplicado({ pacotes, planos, aplicados });
  if (!cmp.temDivergencia) return "";
  const itens = cmp.linhas
    .map((l) => {
      const just = l.justificativa
        ? `<p class="plano-aplicado-just">${escapeHtml(l.justificativa)}</p>`
        : "";
      return `<li><strong>${escapeHtml(l.nome)}</strong> — ${escapeHtml(l.detalhe)}${just}</li>`;
    })
    .join("");
  return `<div class="plano-aplicado-divergencia" role="status">
    <p class="plano-aplicado-divergencia-title">Plano/pacote × o que foi aplicado</p>
    <ul>${itens}</ul>
    <p class="client-hint">Humano decide. Se o método mudou, registre na observação. O atendimento não trava e o preço não muda sozinho.</p>
  </div>`;
}

function renderProtocoloAplicadoItem(a) {
  const nome = a.protocolos?.nome || (a.descricao ? "" : "—");
  const desc = (a.descricao || "").trim();
  const prods = Array.isArray(a.produtos_usados) ? a.produtos_usados : [];
  const produtosStr = prods.length ? prods.map((p) => `${escapeHtml(p.produto_nome || "")}${(p.quantidade && p.quantidade !== 1) ? " × " + p.quantidade : ""}`).join(", ") : "";
  const cmp = compararEstoquePrevistoReal({ previsto: a._previsto || [], real: prods });
  const estoqueHtml = cmp.temDivergencia
    ? `<ul class="protocolo-estoque-previsto">${cmp.linhas.map((l) => {
        const label = l.tipo === "faltou"
          ? `previsto ${l.previsto}, não listado no real`
          : l.tipo === "extra"
            ? `só no real (${l.real})`
            : `previsto ${l.previsto} × real ${l.real}`;
        return `<li><strong>${escapeHtml(l.nome)}</strong> — ${escapeHtml(label)}</li>`;
      }).join("")}</ul>`
    : "";
  return `
    <li class="protocolo-aplicado-item">
      <span class="protocolo-aplicado-data">${formatDateTime(a.aplicado_em)}</span>
      ${nome ? `<span class="protocolo-aplicado-nome">${escapeHtml(nome)}</span>` : ""}
      ${desc ? `<p class="protocolo-aplicado-desc">${escapeHtml(desc)}</p>` : ""}
      ${produtosStr ? `<p class="protocolo-aplicado-produtos">Produtos: ${produtosStr}</p>` : ""}
      ${estoqueHtml}
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

function htmlFotoEvolucao(ph, alt, extraClass = "") {
  const url = escapeHtml(ph?.photo_url || "");
  return `<a href="${url}" target="_blank" rel="noopener" class="cliente-evolucao-foto-link ${extraClass}">
    <img src="${url}" alt="${escapeHtml(alt || "")}" class="cliente-evolucao-foto-thumb" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23f1f5f9%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2255%22 fill=%22%2394a3b8%22 text-anchor=%22middle%22 font-size=%2212%22%3EErro%3C/text%3E%3C/svg%3E'">
  </a>`;
}

function htmlResumoParesFicha(photos) {
  const n = paresAntesDepois(photos).pares.length;
  if (!n) {
    return `<p class="antes-depois-ficha-resumo">Ainda sem par antes/depois. Tire o antes na consulta.</p>`;
  }
  return `<p class="antes-depois-ficha-resumo">${n} par${n === 1 ? "" : "es"} no prontuário. Abrir Evolução para mostrar na consulta. Sem post automático.</p>`;
}

function renderParesAntesDepois(photos, proceduresList = []) {
  const procMap = (proceduresList || []).reduce((acc, p) => { acc[p.id] = p.name; return acc; }, {});
  const { pares } = paresAntesDepois(photos);
  if (!pares.length) {
    return `<p class="cliente-evolucao-empty">Sem par ainda. Grave um <strong>antes</strong> e, na sessão seguinte, o <strong>depois</strong> no mesmo procedimento. WhatsApp e rede não saem daqui.</p>`;
  }
  return pares
    .map((par, idx) => {
      const rotulo = escapeHtml(rotuloParEvolucao(par, procMap));
      return `<article class="antes-depois-par">
        <p class="antes-depois-par-kicker">Antes / depois</p>
        <p class="antes-depois-par-rotulo">${rotulo}</p>
        <div class="antes-depois-par-grid">
          <figure class="antes-depois-lado">
            ${htmlFotoEvolucao(par.antes, "Antes")}
            <figcaption>Antes · ${escapeHtml(formatDate(par.antes.taken_at))}</figcaption>
            <button type="button" class="btn-evolution-photo-delete btn-sm" data-id="${escapeHtml(par.antes.id)}" title="Excluir foto">Excluir antes</button>
          </figure>
          <figure class="antes-depois-lado">
            ${htmlFotoEvolucao(par.depois, "Depois")}
            <figcaption>Depois · ${escapeHtml(formatDate(par.depois.taken_at))}</figcaption>
            <button type="button" class="btn-evolution-photo-delete btn-sm" data-id="${escapeHtml(par.depois.id)}" title="Excluir foto">Excluir depois</button>
          </figure>
        </div>
        <button type="button" class="btn-secondary btn-sm btn-comparar-par" data-par-idx="${idx}">Comparar este par</button>
        <p class="antes-depois-par-fonte">Fonte: fotos de evolução no prontuário.</p>
      </article>`;
    })
    .join("");
}

function renderEvolutionPhotosSoltas(photos, proceduresList = []) {
  const { soltas } = paresAntesDepois(photos);
  if (!(photos || []).length) {
    return `<p class="cliente-evolucao-empty">Nenhuma foto ainda. Use Histórico para adicionar.</p>`;
  }
  if (!soltas.length) {
    return `<p class="cliente-evolucao-empty">Todas as fotos já estão em um par.</p>`;
  }
  return renderEvolutionPhotosGrid(soltas, proceduresList);
}

function renderEvolutionPhotosList(photos, proceduresList = []) {
  if (!photos || photos.length === 0) {
    return `<p class="cliente-evolucao-empty">Nenhuma foto de evolução ainda. Use o formulário abaixo para o antes e, depois, o depois.</p>`;
  }
  return renderEvolutionPhotosSoltas(photos, proceduresList);
}

function renderEvolutionPhotosGrid(photos, proceduresList = []) {
  const procMap = (proceduresList || []).reduce((acc, p) => { acc[p.id] = p.name; return acc; }, {});
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
    byFuncao[slug].push(r);
  }
  const urlDeFoto = (f) => (typeof f === "string" ? f : f?.url);
  const cards = Object.entries(byFuncao).map(([slug, list]) => {
    const nome = list[0].anamnesis_funcoes?.nome || slug;
    const ultimo = list[0];
    const data = ultimo.created_at ? new Date(ultimo.created_at).toLocaleDateString("pt-BR") : "—";
    const versaoTxt = rotuloVersaoAnamnese({ n: list.length, total: list.length });
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
          <span class="cliente-evolucao-data">${escapeHtml(data)}${versaoTxt ? ` · ${escapeHtml(versaoTxt)}` : ""}${badge}</span>
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
      <p class="client-hint">Registros de anamnese (Rosto — Injetáveis) com pontos de aplicação. <strong>Ver mapa</strong> abre em 3D (girar e ampliar o local). Imprimir vira folha 2D com ml/UI.</p>
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
    const fase = pontoStatus(p) === "planejado" ? " · planejado" : " · aplicado";
    const obs = p.observacao ? ` · ${p.observacao}` : "";
    return nome + qty + fase + obs;
  };

  const tabsHtml = MAPAS.map((m) => {
    const list = byMapa[m.id] || [];
    const dotsHtml = list.map((p) => {
      const x = (p.x_pct != null ? p.x_pct : 50);
      const y = (p.y_pct != null ? p.y_pct : 50);
      const qty = p.quantidade != null ? `<span class="mapa-dot-qty">${escapeHtml(String(p.quantidade))} ${escapeHtml(p.unidade || "")}</span>` : "";
      return `<div class="injetaveis-mapa-dot${pontoStatus(p) === "planejado" ? " injetaveis-mapa-dot--planejado" : ""}" style="left:${x}%;top:${y}%;" data-x="${x}" data-y="${y}" title="${escapeHtml(pontoLine(p))}">${qty}</div>`;
    }).join("");
    const listItems = list.map((p) => `<li class="injetaveis-mapa-lista-item">${escapeHtml(pontoLine(p))}</li>`).join("");
    return `
      <div class="injetaveis-mapa-panel" data-mapa="${m.id}" id="modalMapaPanel_${m.id}">
        <div class="mapa-3d">
          ${htmlToolbarMapa3d()}
          <div class="mapa-3d-viewport">
            <div class="mapa-3d-scene">
              <div class="injetaveis-mapa-svg-wrap">
                ${m.svg}
                <div class="injetaveis-mapa-dots">${dotsHtml}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="injetaveis-mapa-lista">
          <p class="injetaveis-mapa-lista-title">${escapeHtml(m.label)} — planejado e aplicado</p>
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
  openModal("Mapa de aplicação — 3D na tela, 2D na impressão", modalHtml, () => closeModal(), null, { hideSubmit: true, cardClass: "modal-card--mapa-3d" });

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
  container.querySelectorAll(".mapa-3d").forEach((el) => {
    const panel = el.closest(".injetaveis-mapa-panel");
    const api = bindMapa3d(el, {
      titulo: "Mapa de aplicação — " + (panel?.dataset.mapa || "") + (dataStr ? " · " + dataStr : ""),
      getPrintRoot: () => panel,
    });
    panel?.querySelectorAll(".injetaveis-mapa-dot").forEach((dot) => {
      dot.style.pointerEvents = "auto";
      dot.style.cursor = "zoom-in";
      dot.addEventListener("click", () => {
        api?.zoomTo(Number(dot.dataset.x), Number(dot.dataset.y));
      });
    });
  });
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
        await refreshEvolutionPhotosUi(clientId);
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

async function refreshEvolutionPhotosUi(clientId) {
  const photos = await listEvolutionPhotosByClient(clientId);
  cachedEvolutionPhotos = photos;
  const procs = cachedProceduresList || [];
  const listEl = document.getElementById("clienteEvolutionPhotosList");
  if (listEl) listEl.innerHTML = renderEvolutionPhotosList(photos, procs);
  const paresEl = document.getElementById("clienteEvolutionPhotosPares");
  if (paresEl) paresEl.innerHTML = renderParesAntesDepois(photos, procs);
  const paresEvo = document.getElementById("clienteEvolutionPhotosParesEvolucao");
  if (paresEvo) paresEvo.innerHTML = renderParesAntesDepois(photos, procs);
  const listEvo = document.getElementById("clienteEvolutionPhotosListEvolucao");
  if (listEvo) listEvo.innerHTML = renderEvolutionPhotosSoltas(photos, procs);
  const resumo = document.querySelector(".antes-depois-ficha-resumo");
  if (resumo) resumo.outerHTML = htmlResumoParesFicha(photos);
  updateCompararFotosWrap(photos);
  bindEvolutionPhotoDeletes(clientId);
  bindCompararFotos(clientId);
}

function openCompararFotosModal(clientId, parIdx = null) {
  const photos = cachedEvolutionPhotos || [];
  if (photos.length < 2) {
    toast("É preciso ter pelo menos 2 fotos para comparar.");
    return;
  }
  const { pares } = paresAntesDepois(photos);
  const par = Number.isInteger(parIdx) && pares[parIdx] ? pares[parIdx] : pares[0] || null;
  const def = indicesParPadrao(photos, par);
  const options = photos.map((p, i) => `<option value="${i}">${formatDate(p.taken_at)} — ${p.type === "depois" ? "Depois" : "Antes"}${p.notes ? " — " + escapeHtml(p.notes) : ""}</option>`).join("");
  openModal(
    "Comparar fotos",
    `
    <p class="client-hint">Duas fotos compactas, para mostrar no aparelho durante a consulta. Não publica em rede.</p>
    <div class="comparar-fotos-selects">
      <label>Primeira foto</label>
      <select id="comparePhoto1">${options}</select>
      <label>Segunda foto</label>
      <select id="comparePhoto2">${options}</select>
    </div>
    <div id="comparePhotosPreview" class="comparar-fotos-preview" aria-live="polite"></div>
    `,
    () => closeModal(),
    null,
    { cardClass: "modal-card--compare" }
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
        <p class="comparar-fotos-legenda">${formatDate(p1.taken_at)} — ${ehDepois(p1) ? "Depois" : "Antes"}${p1.notes ? " · " + escapeHtml(p1.notes) : ""}</p>
      </div>
      <div class="comparar-fotos-lado">
        <img src="${escapeHtml(p2.photo_url)}" alt="Foto 2" class="comparar-fotos-img">
        <p class="comparar-fotos-legenda">${formatDate(p2.taken_at)} — ${ehDepois(p2) ? "Depois" : "Antes"}${p2.notes ? " · " + escapeHtml(p2.notes) : ""}</p>
      </div>
    `;
  }
  sel1?.addEventListener("change", renderPreview);
  sel2?.addEventListener("change", renderPreview);
  if (sel1) sel1.value = String(def.i1);
  if (sel2) sel2.value = String(def.i2);
  renderPreview();
}

function bindCompararFotos(clientId) {
  const btnHist = document.getElementById("btnCompararFotos");
  if (btnHist) btnHist.onclick = () => openCompararFotosModal(clientId);
  const btnEvo = document.getElementById("btnCompararFotosEvolucao");
  if (btnEvo) btnEvo.onclick = () => openCompararFotosModal(clientId);
  document.querySelectorAll(".btn-comparar-par").forEach((btn) => {
    btn.onclick = () => openCompararFotosModal(clientId, Number(btn.dataset.parIdx));
  });
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
  const { pares } = paresAntesDepois(photos);
  const paresHtml = pares.length
    ? `<div class="evolucao-grid">${pares
        .slice(0, 4)
        .map(
          (par) =>
            `<div class="evolucao-col"><h3>Antes · ${formatDate(par.antes.taken_at)}</h3><div class="evolucao-fotos"><div class="evolucao-foto-item"><img src="${String(par.antes.photo_url || "").replace(/"/g, "&quot;")}" alt=""></div></div></div><div class="evolucao-col"><h3>Depois · ${formatDate(par.depois.taken_at)}</h3><div class="evolucao-fotos"><div class="evolucao-foto-item"><img src="${String(par.depois.photo_url || "").replace(/"/g, "&quot;")}" alt=""></div></div></div>`
        )
        .join("")}</div>`
    : "";
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
  <p>Relatório antes/depois para acompanhamento. Só compartilhe se o cliente autorizou a imagem. O sistema não publica sozinho.</p>
  ${paresHtml || `<div class="evolucao-grid">${fotosHtml(antes, "Antes")}${fotosHtml(depois, "Depois")}</div>`}
  ${!photos.length ? "<p>Nenhuma foto de evolução registrada. Adicione na aba Histórico (Fotos antes/depois).</p>" : ""}
  <div class="footer">Gerado pelo SkinClinic. Use com autorização de imagem do cliente. Sem post automático.</div>
  <script>window.onload=function(){window.print();};</script>
</body>
</html>`);
  win.document.close();
}

function renderOrcamentosList(orcamentos, canEdit, extra = {}) {
  if (!orcamentos?.length) {
    return "<li class=\"cliente-orcamentos-empty\">Nenhum orçamento. Clique em \"Novo orçamento\" para montar a proposta.</li>";
  }
  const vistos = idsOrcamentosVistos(extra.events);
  const pkgMap = contarPacotesPorOrcamento(extra.pacotes);
  return orcamentos.map((o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    const total = totalOrcamento(items);
    const linhas = items.map((it) => `${escapeHtml(it.name || "Item")} × ${Number(it.qty) || 1}`).join("; ");
    const efetivo = statusEfetivoOrcamento(o, undefined, {
      visto: vistos.has(o.id),
      packagesCount: pkgMap[o.id] || 0,
    });
    const acoes = canEdit && efetivo !== "aceito" && efetivo !== "recusado" && efetivo !== "expirado" && efetivo !== "convertido"
      ? `${efetivo === "enviado" ? `<button type="button" class="btn-secondary btn-sm orcamento-visto" data-id="${escapeHtml(o.id)}">Marcou como visto</button>` : ""}
         <button type="button" class="btn-secondary btn-sm orcamento-enviar" data-id="${escapeHtml(o.id)}">Enviar WhatsApp</button>
         <button type="button" class="btn-primary btn-sm orcamento-aceitar" data-id="${escapeHtml(o.id)}">Fechou</button>
         <button type="button" class="btn-secondary btn-sm orcamento-recusar" data-id="${escapeHtml(o.id)}">Recusou</button>`
      : efetivo === "expirado"
        ? `<span class="cliente-orcamento-expirado-hint">Venceu. Monte outro orçamento.</span>`
        : efetivo === "visualizado"
          ? `<button type="button" class="btn-secondary btn-sm orcamento-enviar" data-id="${escapeHtml(o.id)}">Enviar WhatsApp</button>
         <button type="button" class="btn-primary btn-sm orcamento-aceitar" data-id="${escapeHtml(o.id)}">Fechou</button>
         <button type="button" class="btn-secondary btn-sm orcamento-recusar" data-id="${escapeHtml(o.id)}">Recusou</button>`
        : "";
    return `<li class="cliente-orcamento-item cliente-orcamento-item--${escapeHtml(efetivo)}" data-id="${escapeHtml(o.id)}">
      <span class="cliente-orcamento-status">${escapeHtml(statusOrcamentoLabel(efetivo))}</span>
      <span class="cliente-orcamento-total">${brl(total)}</span>
      <span class="cliente-orcamento-itens">${linhas || "—"}</span>
      ${hintParcelasInterno(o.items, extra)}${o.valid_until ? `<span class="cliente-orcamento-valid">Até ${formatDate(o.valid_until)}</span>` : ""}
      <span class="cliente-orcamento-acoes">${acoes}</span>
    </li>`;
  }).join("");
}

async function reloadPerfilOrcamentos() {
  sessionStorage.setItem("clientePerfilOpenTab", "orcamentos");
  await init();
}

function hintParcelasInterno(items, extra = {}) {
  const taxas = extra.taxas;
  if (!taxas || !items?.length) return "";
  const resumo = resumoMargemOrcamento(items);
  if (!(resumo.receita > 0)) return "";
  const margemAlvo = taxas.margem_alvo_padrao_pct != null ? Number(taxas.margem_alvo_padrao_pct) : 40;
  const maxFixo = taxas.parcelamento_max_parcelas != null ? Number(taxas.parcelamento_max_parcelas) : 12;
  const parc = maxParcelasPreservandoLucro({
    valor: resumo.receita,
    custo: resumo.custoTotal || 0,
    margemAlvoPct: margemAlvo,
    maxFixo,
    getLiquido: (n) => calcularLiquido(resumo.receita, getTaxaForParcelas(taxas, n, "credito")),
  });
  const parcelaTxt = parc.parcelaCliente != null ? ` de ${brl(parc.parcelaCliente)}` : "";
  return `<span class="cliente-orcamento-parcelas">Sem juros p/ o cliente: até ${parc.maxParcelas}x${parcelaTxt} (interno · insumos + maquininha)</span>`;
}

function sqlOrcamentoHint(err) {
  const msg = String(err?.message || err || "");
  if (/orcamentos|42P01|PGRST205|schema cache|does not exist/i.test(msg)) {
    return "Cole supabase-orcamentos-colar.sql no Supabase.";
  }
  return msg || "Erro no orçamento.";
}

function openOrcamentoModal(client, proceduresList) {
  const procs = proceduresList || [];
  Promise.all([
    listProdutosCatalogo().catch(() => []),
    getTaxas().catch(() => ({})),
    getOrganizationProfile().catch(() => null),
    listAllProcedureStockUsage().catch(() => []),
    getResumoPorProduto().catch(() => []),
  ]).then(([catalogo, taxas, profile, usages, resumo]) => {
    const map = {};
    for (const r of resumo || []) {
      const n = String(r.produto_nome || "").trim().toLowerCase();
      if (n && r.custo_medio != null && Number.isFinite(Number(r.custo_medio))) map[n] = Number(r.custo_medio);
    }
    const custoReceitaById = {};
    const byProc = {};
    for (const u of usages || []) {
      if (!u.procedure_id) continue;
      (byProc[u.procedure_id] ||= []).push(u);
    }
    for (const [id, rows] of Object.entries(byProc)) {
      const out = custoRealFromUsage(rows, map);
      if (out.custoReal != null) custoReceitaById[id] = out.custoReal;
    }
    bindOrcamentoModal(client, procs, catalogo || [], taxas || {}, profile, custoReceitaById);
  });
}

async function bindOrcamentoModal(client, procs, catalogo, taxas, profile, custoReceitaById = {}) {
  const opts = procs.map((p) => {
    const price = p.valor_cobrado != null ? Number(p.valor_cobrado) : 0;
    const cost = custoUnitarioServico(p, {
      comissaoPadraoPct: profile?.comissao_profissional_padrao_pct,
      custoMaterialReal: custoReceitaById[p.id],
    });
    return `<option value="${escapeHtml(p.id)}" data-kind="servico" data-name="${escapeHtml(p.name)}" data-price="${price}" data-cost="${cost ?? ""}">${escapeHtml(p.name)}${price ? " — " + brl(price) : ""}</option>`;
  }).join("");
  const vendePro = profile?.vende_para_profissional === true;
  const optsProd = (catalogo || []).map((p) => {
    const price = vendePro && p.preco_profissional != null
      ? Number(p.preco_profissional)
      : (p.preco_cliente != null ? Number(p.preco_cliente) : 0);
    const cost = custoCatalogoComFrete(p.custo_pago, p.frete_padrao);
    return `<option value="${escapeHtml(p.id)}" data-kind="produto" data-name="${escapeHtml(p.nome)}" data-price="${price || 0}" data-cost="${cost ?? ""}">${escapeHtml(p.nome)}${price ? " — " + brl(price) : ""}</option>`;
  }).join("");
  const validade = new Date();
  validade.setDate(validade.getDate() + 15);
  const validStr = validade.toISOString().slice(0, 10);
  const margemAlvo = profile?.margem_alvo_padrao_pct != null ? Number(profile.margem_alvo_padrao_pct) : 40;
  const maxFixo = profile?.parcelamento_max_parcelas != null ? Number(profile.parcelamento_max_parcelas) : 12;
  const members = await getOrgMembers().catch(() => []);
  const soldOpts = (members || []).map((m) => {
    const label = String(m.display_name || m.email || "Profissional").replace(/</g, "&lt;");
    return `<option value="${m.user_id}">${label}</option>`;
  }).join("");
  openModal(
    "Novo orçamento",
    `
    <p class="client-hint">Monte serviço e produto no mesmo orçamento. Embaixo do total aparece até quantas vezes <strong>sem juros para o cliente</strong> ainda é saudável (insumos + comissão + taxa da maquininha). Só a equipe vê. O sistema não muda o preço.</p>
    <fieldset class="orcamento-kind">
      <legend>Tipo da linha</legend>
      <label><input type="radio" name="orcamentoKind" value="servico" checked> Serviço</label>
      <label><input type="radio" name="orcamentoKind" value="produto"> Produto</label>
    </fieldset>
    <div id="orcamentoBlocoServico">
      <label for="orcamentoProc">Procedimento</label>
      <select id="orcamentoProc"><option value="">— Selecione —</option>${opts}</select>
    </div>
    <div id="orcamentoBlocoProduto" class="hidden">
      <label for="orcamentoProd">Produto do portfólio</label>
      <select id="orcamentoProd"><option value="">— Selecione —</option>${optsProd}</select>
    </div>
    <label for="orcamentoQty">Quantidade / sessões</label>
    <input type="number" id="orcamentoQty" min="1" step="1" value="1">
    <label for="orcamentoPreco">Valor unitário (R$)</label>
    <input type="number" id="orcamentoPreco" min="0" step="0.01" value="0">
    <label for="orcamentoNomeLivre">Ou descreva o item</label>
    <input type="text" id="orcamentoNomeLivre" placeholder="Ex.: Harmonização — 2ml">
    <button type="button" class="btn-secondary" id="orcamentoAddLinha">Adicionar à proposta</button>
    <ul id="orcamentoLinhas" class="cliente-orcamento-linhas"></ul>
    <div id="orcamentoTotal" class="cliente-orcamento-total-preview">Total: ${brl(0)}</div>
    <label for="orcamentoValid">Válido até</label>
    <input type="date" id="orcamentoValid" value="${validStr}">
    <label for="orcamentoSoldBy">Quem vendeu (opcional)</label>
    <select id="orcamentoSoldBy">
      <option value="">Não informar</option>
      ${soldOpts}
    </select>
    <p class="form-hint">Quem fechou a proposta. Quem aplica você escolhe depois na Agenda. Não muda preço.</p>
    <label for="orcamentoNotes">Observação (opcional)</label>
    <textarea id="orcamentoNotes" rows="2" placeholder="Ex.: incluir avaliação, forma de pagamento"></textarea>
    `,
    async () => {
      const items = readOrcamentoLinhas();
      if (!items.length) {
        toast("Adicione pelo menos um item.");
        return false;
      }
      const notes = document.getElementById("orcamentoNotes")?.value?.trim() || null;
      const valid_until = document.getElementById("orcamentoValid")?.value || null;
      try {
        await createOrcamento({
          client_id: client.id,
          items,
          notes,
          valid_until,
          status: "rascunho",
          sold_by_user_id: document.getElementById("orcamentoSoldBy")?.value?.trim() || null,
        });
        await applyRelacaoComercial(client.id, client.relacao_comercial, "orcamento_criado");
        closeModal();
        toast("Orçamento salvo no paciente.");
        await reloadPerfilOrcamentos();
      } catch (err) {
        toast(sqlOrcamentoHint(err), "error");
        return false;
      }
    }
  );
  const syncKind = () => {
    const kind = document.querySelector("input[name=orcamentoKind]:checked")?.value || "servico";
    document.getElementById("orcamentoBlocoServico")?.classList.toggle("hidden", kind !== "servico");
    document.getElementById("orcamentoBlocoProduto")?.classList.toggle("hidden", kind !== "produto");
  };
  document.querySelectorAll("input[name=orcamentoKind]").forEach((el) => el.addEventListener("change", syncKind));
  const fillFromSelect = (sel) => {
    const opt = sel?.selectedOptions?.[0];
    const preco = document.getElementById("orcamentoPreco");
    if (opt?.dataset.price && preco) preco.value = opt.dataset.price;
  };
  document.getElementById("orcamentoProc")?.addEventListener("change", (e) => fillFromSelect(e.target));
  document.getElementById("orcamentoProd")?.addEventListener("change", (e) => fillFromSelect(e.target));
  document.getElementById("orcamentoAddLinha")?.addEventListener("click", () => {
    const kind = document.querySelector("input[name=orcamentoKind]:checked")?.value || "servico";
    const sel = kind === "produto" ? document.getElementById("orcamentoProd") : document.getElementById("orcamentoProc");
    const opt = sel?.selectedOptions?.[0];
    const livre = document.getElementById("orcamentoNomeLivre")?.value?.trim() || "";
    const name = (opt?.dataset.name && sel?.value) ? opt.dataset.name : livre;
    const qty = Number(document.getElementById("orcamentoQty")?.value) || 1;
    const unit_price = Number(document.getElementById("orcamentoPreco")?.value) || 0;
    if (!name) {
      toast(kind === "produto" ? "Escolha um produto ou descreva o item." : "Escolha um procedimento ou descreva o item.");
      return;
    }
    const costRaw = opt?.dataset.cost;
    const unit_cost = costRaw === "" || costRaw == null ? null : Number(costRaw);
    pushOrcamentoLinha({
      kind,
      procedure_id: kind === "servico" ? (sel?.value || null) : null,
      product_id: kind === "produto" ? (sel?.value || null) : null,
      name,
      qty,
      unit_price,
      sessions: kind === "servico" ? qty : 1,
      unit_cost: Number.isFinite(unit_cost) ? unit_cost : null,
    });
    if (sel) sel.value = "";
    const livreEl = document.getElementById("orcamentoNomeLivre");
    if (livreEl) livreEl.value = "";
  });
  orcamentoTaxasCtx = { taxas, margemAlvo, maxFixo };
}

function readOrcamentoLinhas() {
  const ul = document.getElementById("orcamentoLinhas");
  const items = [];
  ul?.querySelectorAll("li[data-name]")?.forEach((li) => {
    const unit_cost = li.dataset.cost === "" || li.dataset.cost == null ? null : Number(li.dataset.cost);
    items.push({
      kind: li.dataset.kind || "servico",
      procedure_id: li.dataset.procedureId || null,
      product_id: li.dataset.productId || null,
      name: li.dataset.name,
      qty: Number(li.dataset.qty) || 1,
      unit_price: Number(li.dataset.price) || 0,
      sessions: Number(li.dataset.sessions) || Number(li.dataset.qty) || 1,
      unit_cost: Number.isFinite(unit_cost) ? unit_cost : null,
    });
  });
  return items;
}

function pushOrcamentoLinha(item) {
  const ul = document.getElementById("orcamentoLinhas");
  if (!ul) return;
  const li = document.createElement("li");
  li.dataset.name = item.name;
  li.dataset.kind = item.kind || "servico";
  li.dataset.procedureId = item.procedure_id || "";
  li.dataset.productId = item.product_id || "";
  li.dataset.qty = String(item.qty);
  li.dataset.price = String(item.unit_price);
  li.dataset.sessions = String(item.sessions || item.qty);
  li.dataset.cost = item.unit_cost == null ? "" : String(item.unit_cost);
  const tipo = item.kind === "produto" ? "Produto" : "Serviço";
  li.innerHTML = `<span>${escapeHtml(tipo)} · ${escapeHtml(item.name)} × ${item.qty} — ${brl(linhaTotal(item))}</span> <button type="button" class="btn-sm" aria-label="Remover">×</button>`;
  li.querySelector("button")?.addEventListener("click", () => {
    li.remove();
    refreshOrcamentoTotal();
  });
  ul.appendChild(li);
  refreshOrcamentoTotal();
}

function refreshOrcamentoTotal() {
  const el = document.getElementById("orcamentoTotal");
  if (!el) return;
  const items = readOrcamentoLinhas();
  const resumo = resumoMargemOrcamento(items);
  const ctx = orcamentoTaxasCtx || {};
  const taxas = ctx.taxas || {};
  const margemAlvo = ctx.margemAlvo != null ? ctx.margemAlvo : 40;
  const parc = maxParcelasPreservandoLucro({
    valor: resumo.receita,
    custo: resumo.custoTotal || 0,
    margemAlvoPct: margemAlvo,
    maxFixo: ctx.maxFixo || 12,
    getLiquido: (n) => calcularLiquido(resumo.receita, getTaxaForParcelas(taxas, n, "credito")),
  });
  const linhaP = resumo.receitaProduto > 0
    ? `Produto: ${brl(resumo.receitaProduto)}${resumo.margemProdutoPct != null ? ` · margem ${resumo.margemProdutoPct}% (${brl(resumo.lucroProduto)})` : " · informe custo no portfólio"}`
    : "";
  const linhaS = resumo.receitaServico > 0
    ? `Serviço: ${brl(resumo.receitaServico)}${resumo.margemServicoPct != null ? ` · margem ${resumo.margemServicoPct}% (${brl(resumo.lucroServico)})` : " · informe custo/material no procedimento"}`
    : "";
  el.innerHTML = `<strong>Total: ${brl(resumo.receita)}</strong>
    ${linhaS ? `<p>${linhaS}</p>` : ""}
    ${linhaP ? `<p>${linhaP}</p>` : ""}
    ${resumo.custoTotal == null ? `<p>Sem custo de insumo nas linhas, a conta de parcela fica incompleta — preencha receita/custo no procedimento ou no produto.</p>` : ""}
    <p class="orcamento-parcelas-saudavel">${escapeHtml(textoParcelasSemJuros(parc, { brl }))}</p>`;
}

function hojeIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function oferecerAgendaAposAceite(client, packages, proceduresList) {
  const pkgs = (packages || []).filter((p) => p && p.client_id);
  if (!pkgs.length) return;
  const totalSessoes = pkgs.reduce((s, p) => s + Math.max(1, Number(p.total_sessoes) || 1), 0);
  const nomes = pkgs.map((p) => p.nome_pacote).filter(Boolean).join(", ");
  openModal(
    "Marcar na agenda?",
    `
    <p class="client-hint">O pacote já está no cadastro. Marque o horário agora — WhatsApp não sai sozinho e o preço não muda.</p>
    <p>${escapeHtml(nomes || "Pacote")} · ${totalSessoes} sessão(ões).</p>
    <label for="aceiteAgendaData">Primeira sessão</label>
    <input type="date" id="aceiteAgendaData" value="${hojeIsoLocal()}" required>
    <label for="aceiteAgendaHora">Horário</label>
    <input type="time" id="aceiteAgendaHora" value="09:00" required>
    <label class="checkbox-row"><input type="checkbox" id="aceiteAgendaTodas"> Agendar as demais também (a cada 7 dias, mesmo horário)</label>
    `,
    async () => {
      const startDate = document.getElementById("aceiteAgendaData")?.value;
      const startTime = document.getElementById("aceiteAgendaHora")?.value;
      if (!startDate || !startTime) {
        toast("Informe data e hora da primeira sessão.");
        return false;
      }
      const onlyFirst = !document.getElementById("aceiteAgendaTodas")?.checked;
      const slots = slotsAgendaDoAceite({
        packages: pkgs,
        procedures: proceduresList || [],
        startDate,
        startTime,
        intervalDays: 7,
        onlyFirst,
      });
      if (!slots.length) {
        toast("Não foi possível montar os horários.");
        return false;
      }
      try {
        const criados = await createAgendaSlots(slots, { clientId: client.id });
        closeModal();
        toast(
          criados.length === 1
            ? "1 horário na Agenda. Abra a Agenda para conferir sala e profissional."
            : `${criados.length} horários na Agenda. Conflitos de sala/profissional você ajusta lá.`
        );
        sessionStorage.setItem("agendaDefaultDate", slots[0].data);
        navigate("agenda");
      } catch (err) {
        toast(err.message || "Não foi possível agendar.");
        return false;
      }
    }
  );
}

function bindOrcamentoCardActions(client, orcamentos, proceduresList = []) {
  document.querySelectorAll(".orcamento-visto").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = (orcamentos || []).find((o) => o.id === btn.dataset.id);
      if (!row) return;
      const payload = payloadOrcamentoVisto(row.id);
      if (!payload) return;
      try {
        await createClientEvent({ client_id: client.id, ...payload });
        toast("Marcado como visualizado. O status do banco continua enviado — o CHECK não muda.");
        await reloadPerfilOrcamentos();
      } catch (err) {
        toast(sqlOrcamentoHint(err), "error");
      }
    });
  });
  document.querySelectorAll(".orcamento-enviar").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = (orcamentos || []).find((o) => o.id === btn.dataset.id);
      if (!row) return;
      if (isOrcamentoExpirado(row)) {
        toast("Este orçamento venceu. Monte outro.");
        return;
      }
      try {
        const profile = await getOrganizationProfile().catch(() => ({}));
        const msg = formatOrcamentoMensagem({
          nomeClinica: profile?.name,
          nomeCliente: client.name,
          items: row.items,
          notes: row.notes,
          validUntil: row.valid_until,
        });
        await sendWhatsapp(client.phone, msg, { origem: "orcamento", clientId: client.id });
        if (row.status === "rascunho") await updateOrcamentoStatus(row.id, "enviado");
        toast("WhatsApp aberto. Confira a mensagem antes de enviar.");
        await reloadPerfilOrcamentos();
      } catch (err) {
        toast(sqlOrcamentoHint(err), "error");
      }
    });
  });
  document.querySelectorAll(".orcamento-aceitar").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = (orcamentos || []).find((o) => o.id === btn.dataset.id);
      if (!row) return;
      if (isOrcamentoExpirado(row)) {
        toast("Este orçamento venceu. Monte outro; o catálogo não muda sozinho.");
        return;
      }
      openConfirmModal(
        "Fechou o orçamento?",
        "Ele fica no cadastro e vira pacote de sessões (se houver quantidade). O preço do catálogo não muda.",
        () => {
          void (async () => {
            try {
              const aceite = await aceitarOrcamento(row.id);
              await applyRelacaoComercial(client.id, client.relacao_comercial, "orcamento_aceito");
              const pkgs = aceite.packages || [];
              if (!aceite.created) {
                toast("Este orçamento já estava no cadastro. Pacote não foi duplicado.");
              } else {
                const items = Array.isArray(row.items) ? row.items : [];
                await createClientEvent({
                  client_id: client.id,
                  event_type: "Orçamento aceito",
                  description: formatOrcamentoMensagem({ nomeCliente: client.name, items, notes: row.notes }),
                });
                await audit({
                  action: "orcamento.aceito",
                  tableName: "orcamentos",
                  recordId: row.id,
                  permissionUsed: "clientes:manage",
                  metadata: { client_id: client.id, total: totalOrcamento(items) },
                }).catch(() => {});
                toast("Orçamento no paciente. Pacotes na aba Pacotes.");
              }
              if (pkgs.length) {
                oferecerAgendaAposAceite(client, pkgs, proceduresList);
                return;
              }
              sessionStorage.setItem("clientePerfilOpenTab", "orcamentos");
              await init();
            } catch (err) {
              toast(sqlOrcamentoHint(err), "error");
            }
          })();
        }
      );
    });
  });
  document.querySelectorAll(".orcamento-recusar").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await updateOrcamentoStatus(btn.dataset.id, "recusado");
        toast("Orçamento marcado como recusado.");
        await reloadPerfilOrcamentos();
      } catch (err) {
        toast(sqlOrcamentoHint(err), "error");
      }
    });
  });
}

function openVenderPacoteModal(client, proceduresList = []) {
  const opts = (proceduresList || [])
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name || "")}</option>`)
    .join("");
  openModal(
    "Registrar pacote fechado",
    `
    <p class="client-hint">Use quando a pessoa fechou o pacote na hora, sem passar por orçamento. Isso grava as sessões no cadastro.</p>
    <label for="pacoteVendaNome">Nome do pacote</label>
    <input type="text" id="pacoteVendaNome" placeholder="Ex.: Pacote peeling 4 sessões" required>
    <label for="pacoteVendaProc">Procedimento (opcional)</label>
    <select id="pacoteVendaProc"><option value="">— Nenhum —</option>${opts}</select>
    <label for="pacoteVendaSessoes">Sessões</label>
    <input type="number" id="pacoteVendaSessoes" min="1" step="1" value="4">
    <label for="pacoteVendaValor">Valor pago (R$)</label>
    <input type="number" id="pacoteVendaValor" min="0" step="0.01" placeholder="0,00">
    <label for="pacoteVendaValido">Válido até (opcional)</label>
    <input type="date" id="pacoteVendaValido">
    `,
    async () => {
      const nome = document.getElementById("pacoteVendaNome")?.value?.trim();
      const sessoes = parseInt(document.getElementById("pacoteVendaSessoes")?.value, 10);
      if (!nome || !sessoes) {
        toast("Informe o nome e o número de sessões.");
        return;
      }
      try {
        await createPacote({
          client_id: client.id,
          nome_pacote: nome,
          procedure_id: document.getElementById("pacoteVendaProc")?.value || null,
          total_sessoes: sessoes,
          valor_pago: document.getElementById("pacoteVendaValor")?.value || null,
          valido_ate: document.getElementById("pacoteVendaValido")?.value || null,
        });
        closeModal();
        toast("Pacote registrado.");
        sessionStorage.setItem("clientePerfilId", client.id);
        sessionStorage.setItem("clientePerfilOpenTab", "pacotes");
        await init();
      } catch (err) {
        toast(err?.message || "Não foi possível registrar o pacote.");
      }
    }
  );
}

function bindPerfilEvents(client, canEdit, proceduresList = [], orcamentos = []) {
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
  const goToAgenda = () => {
    sessionStorage.setItem("agendaPrefillClientId", client.id);
    navigate("agenda");
    toast("Escolha o horário: a pessoa já vem selecionada.");
  };
  document.getElementById("btnAgendarCliente")?.addEventListener("click", goToAgenda);
  document.getElementById("btnAgendarClienteDados")?.addEventListener("click", goToAgenda);
  document.getElementById("btnCicloAgendarPlano")?.addEventListener("click", () => {
    const planoId = (document.getElementById("cicloAgendarPlanoSelect")?.value || "").trim();
    sessionStorage.setItem("agendaPrefillClientId", client.id);
    if (planoId) sessionStorage.setItem("agendaPrefillPlanoId", planoId);
    navigate("agenda");
    toast("Horário com a pessoa e o plano já escolhidos. Confira e salve.");
  });
  document.getElementById("btnCicloCombinarPlano")?.addEventListener("click", async () => {
    const planoId = (document.getElementById("cicloAgendarPlanoSelect")?.value || "").trim();
    const plano = (cachedPlanosCatalogo || []).find((p) => p.id === planoId);
    if (!planoId || !plano) {
      toast("Escolha um plano do catálogo.");
      return;
    }
    if (jaCombinouPlano(cachedCicloFicha?.events, planoId) || (cachedPlanosCliente || []).some((p) => p.id === planoId)) {
      toast("Este plano já está na ficha. Agende o horário quando quiser.");
      return;
    }
    const payload = payloadPlanoFicha({ clientId: client.id, planoId, nome: plano.nome });
    if (!payload) {
      toast("Não foi possível combinar este plano.");
      return;
    }
    try {
      await createClientEvent(payload);
      toast("Plano na coluna combinado. Horário continua opcional.");
      await init();
    } catch (err) {
      toast(err?.message || "Não foi possível gravar o plano na ficha.");
    }
  });
  document.getElementById("btnCicloCriarPlano")?.addEventListener("click", () => {
    sessionStorage.setItem("sc_open_planos", "1");
    navigate("procedimento");
  });
  document.getElementById("btnCicloRegistrarAplicado")?.addEventListener("click", (e) => {
    const agendaId = e.currentTarget?.dataset?.agendaId || "";
    if (agendaId) sessionStorage.setItem("agendaOpenSlotId", agendaId);
    if (agendaId) sessionStorage.setItem("agendaOpenAplicado", "1");
    navigate("agenda");
    toast("No horário: registre o que foi aplicado. Isso preenche o feito na ficha e o estoque, se houver material.");
  });
  document.getElementById("btnCicloDarBaixa")?.addEventListener("click", (e) => {
    const agendaId = e.currentTarget?.dataset?.agendaId || "";
    if (agendaId) sessionStorage.setItem("agendaOpenSlotId", agendaId);
    navigate("agenda");
    toast("Confira o recebido neste horário. Nada é lançado sozinho.");
  });
  document.getElementById("btnCicloProximaSessao")?.addEventListener("click", (e) => {
    const data = e.currentTarget?.dataset?.date || "";
    sessionStorage.setItem("agendaPrefillClientId", client.id);
    if (data) sessionStorage.setItem("agendaDefaultDate", data);
    navigate("agenda");
    toast("Pessoa já vem selecionada. Confira a data sugerida e salve. WhatsApp não sai daqui.");
  });

  document.getElementById("btnLgpdExport")?.addEventListener("click", async () => {
    try {
      await exportTitularJson(client.id);
      toast("Arquivo do titular baixado.");
    } catch (err) {
      toast(err?.message || "Não foi possível exportar.");
    }
  });
  document.getElementById("btnLgpdErase")?.addEventListener("click", () => {
    openModal(
      "Anonimizar identidade",
      `<p class="client-hint">Nome, telefone, e-mail e CPF serão anonimizados e o acesso ao portal encerrado. <strong>Anamnese, fotos, o que foi aplicado, agenda e financeiro permanecem</strong> no prontuário, para respaldo da clínica em caso de intercorrência. Digite <strong>EXCLUIR</strong> para confirmar. Isto não é declaração de conformidade com a LGPD.</p>
       <label for="lgpdEraseConfirm">Confirmação</label>
       <input id="lgpdEraseConfirm" type="text" autocomplete="off" placeholder="EXCLUIR">`,
      async () => {
        const typed = document.getElementById("lgpdEraseConfirm")?.value?.trim();
        if (typed !== "EXCLUIR") {
          toast("Digite EXCLUIR para confirmar.");
          return;
        }
        try {
          await eraseTitular(client.id);
          closeModal();
          toast("Identidade anonimizada. O prontuário permanece.");
          sessionStorage.removeItem("clientePerfilId");
          navigate("clientes");
        } catch (err) {
          toast(err?.message || "Não foi possível excluir.");
        }
      }
    );
  });

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
        fileEl.value = "";
        notesEl.value = "";
        await refreshEvolutionPhotosUi(client.id);
        const tipo = typeEl?.value || "antes";
        const nPares = paresAntesDepois(cachedEvolutionPhotos).pares.length;
        toast(
          nPares
            ? "Foto no prontuário. Par montado quando há antes e depois no mesmo procedimento."
            : tipo === "depois"
              ? "Depois gravado. Sem par ainda: falta um antes na mesma data ou procedimento."
              : "Antes gravado. Na próxima sessão, tire o depois no mesmo procedimento. Sem post automático."
        );
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
    document.getElementById("btnWhatsappSilencio")?.addEventListener("click", async () => {
      const on = estaEmSilencio(mapaSilencioPorCliente(events || [], new Date().toISOString().slice(0, 10)), client.id);
      const payload = payloadSilencio(client.id, { off: on });
      try {
        await createClientEvent(payload);
        toast(on ? "WhatsApp liberado. Continua só no clique." : "Silêncio gravado. Lembrete automático não manda WhatsApp.");
        init();
      } catch (err) {
        toast(err.message || "Não atualizou o silêncio.");
      }
    });
  }

  document.getElementById("btnEnviarLinkCadastro")?.addEventListener("click", async () => {
    try {
      const { url } = await createClientPortalSession(client.id);
      mostrarLinkPortalCadastro({ url, nome: client.name }, { toast, openModal });
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
      document.querySelectorAll(".tab-pane").forEach((p) => {
        p.classList.add("hidden");
        p.classList.remove("active");
      });
      btn.classList.add("active");
      const paneId = tab === "dados" ? "tabDados" : tab === "historico" ? "tabHistorico" : tab === "protocolo" ? "tabProtocolo" : tab === "evolucao" ? "tabEvolucao" : tab === "pacotes" ? "tabPacotes" : tab === "orcamentos" ? "tabOrcamentos" : "tabRotinaSkincare";
      const pane = document.getElementById(paneId);
      if (pane) {
        pane.classList.remove("hidden");
        pane.classList.add("active");
      }
    });
  });

  document.querySelectorAll(".timeline-filtro").forEach((btn) => {
    btn.addEventListener("click", () => {
      const filtro = btn.dataset.filtro || "todos";
      document.querySelectorAll(".timeline-filtro").forEach((b) => b.classList.toggle("is-active", b === btn));
      document.querySelectorAll("#clienteTimeline .timeline-item[data-vis]").forEach((li) => {
        li.hidden = filtro !== "todos" && li.dataset.vis !== filtro;
      });
    });
  });

  document.getElementById("btnNovoOrcamento")?.addEventListener("click", () => openOrcamentoModal(client, proceduresList));
  document.getElementById("btnPerfilIrOrcamento")?.addEventListener("click", () => {
    document.querySelector('.tab-btn[data-tab="orcamentos"]')?.click();
  });
  document.getElementById("btnCicloVerProtocolo")?.addEventListener("click", () => {
    document.querySelector('.tab-btn[data-tab="protocolo"]')?.click();
    document.getElementById("protocoloDescricao")?.focus();
  });
  document.getElementById("btnCicloVerEvolucao")?.addEventListener("click", () => {
    document.querySelector('.tab-btn[data-tab="evolucao"]')?.click();
  });
  document.getElementById("btnIrFotosHistorico")?.addEventListener("click", () => {
    document.querySelector('.tab-btn[data-tab="historico"]')?.click();
    document.getElementById("clienteEvolutionPhotosWrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.querySelectorAll(".btn-ficha-explicar").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const extra = cachedCicloFicha || {};
      const aplicados = cachedAplicadosFicha || [];
      const linha = linhaCicloOuroCabecalho(
        resumoCicloOuroFicha({
          planosCliente: cachedPlanosCliente,
          protocolos: cachedProtocolosFicha,
          aplicados,
          pacotes: extra.pacotes || [],
        })
      );
      const prox = proximaAcaoCicloFicha({
        planosCliente: cachedPlanosCliente,
        pacotes: extra.pacotes || [],
        aplicados,
        lancamentos: extra.lancamentos || [],
        temAgendaFutura: !!extra.temAgendaFutura,
        today: getTodayLocal(),
      });
      const proxima =
        prox.titulo ||
        (prox.tipo === "registrar" ? "Registrar o que foi aplicado" : "") ||
        (prox.tipo === "baixa" ? "Conferir baixa no horário" : "") ||
        (prox.tipo === "proxima" ? "Agendar próxima sessão" : "");
      const ctx = contextoFichaCopiloto({
        nome: client?.name,
        proxima,
        combinado: linha.combinado,
        receita: linha.receita,
        feito: linha.feito,
        avisoMaterial: aplicadoSemMaterial(aplicados),
      });
      try {
        if (typeof window.__scOpenCopilot === "function") {
          window.__scOpenCopilot(ctx);
          return;
        }
        const { initCopilotPanel, openCopilotPanel } = await import("./notificacoes.views.js");
        initCopilotPanel();
        openCopilotPanel(ctx);
      } catch (err) {
        console.error(err);
        toast("Não foi possível abrir o Copiloto nesta ficha.");
      }
    });
  });
  document.getElementById("btnVenderPacote")?.addEventListener("click", () => openVenderPacoteModal(client, proceduresList));
  bindOrcamentoCardActions(client, orcamentos, proceduresList);

  function addProdutoLinhaFicha(nome, qty) {
    const n = String(nome || "").trim();
    if (!n) return;
    const listEl = document.getElementById("protocoloProdutosList");
    const ja = [...(listEl?.querySelectorAll(".protocolo-produto-line") || [])].some(
      (li) => String(li.dataset.produto || "").trim().toLowerCase() === n.toLowerCase()
    );
    if (ja) return;
    const q = Math.max(0.01, Number(qty) || 1);
    const li = document.createElement("li");
    li.className = "protocolo-produto-line";
    li.dataset.produto = n;
    li.dataset.quantidade = String(q);
    li.innerHTML = `<span>${escapeHtml(n)} × ${q}</span> <button type="button" class="btn-sm btn-remove-produto" title="Remover">×</button>`;
    li.querySelector(".btn-remove-produto")?.addEventListener("click", () => li.remove());
    listEl?.appendChild(li);
  }

  document.getElementById("btnProtocoloAddProduto")?.addEventListener("click", () => {
    const sel = document.getElementById("protocoloProdutoSelect");
    const qtyEl = document.getElementById("protocoloProdutoQty");
    const nome = (sel?.value || "").trim();
    if (!nome) {
      toast("Selecione um produto");
      return;
    }
    addProdutoLinhaFicha(nome, qtyEl?.value);
    sel.value = "";
    if (qtyEl) qtyEl.value = "1";
  });

  document.getElementById("btnProtocoloRascunho")?.addEventListener("click", async () => {
    const ta = document.getElementById("protocoloDescricao");
    if (ta?.value?.trim()) {
      toast("O campo já tem texto. Apague se quiser o rascunho.");
      return;
    }
    const protoId = document.getElementById("protocoloSelect")?.value?.trim() || "";
    const protocolo = (cachedProtocolosFicha || []).find((p) => p.id === protoId) || null;
    const sessoes = (cachedPlanosCliente || []).flatMap((p) => p.sessoes || []);
    const texto = textoRascunhoLocal({ protocolo, sessoes });
    if (texto && ta) ta.value = texto;
    if (protoId) {
      const desc = await getDescartaveisByProtocolo(protoId).catch(() => []);
      for (const p of produtosRascunhoLocal(desc)) addProdutoLinhaFicha(p.produto_nome, p.quantidade);
    }
    if (!texto && !protoId) {
      toast("Escolha um protocolo cadastrado ou tenha receita no plano. Depois confira e registre.");
      return;
    }
    toast("Rascunho no campo. Confira e registre. Nada foi gravado.");
  });

  function esconderPreviewIa() {
    const box = document.getElementById("protocoloIaPreview");
    const pre = document.getElementById("protocoloIaTexto");
    if (pre) pre.textContent = "";
    if (box) {
      box.hidden = true;
      box.classList.add("hidden");
    }
  }

  function mostrarPreviewIa(texto, fonte) {
    const box = document.getElementById("protocoloIaPreview");
    const pre = document.getElementById("protocoloIaTexto");
    const fonteEl = document.getElementById("protocoloIaFonte");
    if (pre) pre.textContent = texto;
    if (fonteEl) fonteEl.textContent = fonte;
    if (box) {
      box.hidden = false;
      box.classList.remove("hidden");
    }
  }

  document.getElementById("btnProtocoloRascunhoIa")?.addEventListener("click", async () => {
    if (!cachedCanIaAssist) {
      toast("Sem permissão para IA auxiliar.");
      return;
    }
    const payload = payloadProtocoloIaFicha({
      anamnese: cachedCicloFicha.anamnese,
      analises: cachedCicloFicha.analises,
      planos: cachedPlanosCliente,
    });
    if (!temFonteParaIa(payload)) {
      toast("IA só sugere com anamnese ou avaliação validada nesta ficha. Não usa rascunho preliminar.");
      return;
    }
    const btn = document.getElementById("btnProtocoloRascunhoIa");
    if (btn) btn.disabled = true;
    try {
      const res = await gerarProtocolo(payload);
      const texto = textoRascunhoDeIa(res?.content ?? res);
      if (!texto) {
        toast("A IA não devolveu um rascunho útil. Nada foi gravado.");
        return;
      }
      mostrarPreviewIa(texto, rotuloFonteIa(payload));
      toast("Sugestão da IA abaixo do campo. Use ou descarte. Nada foi gravado.");
    } catch (err) {
      toast(err?.message || "Não foi possível sugerir com IA.");
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById("btnProtocoloIaUsar")?.addEventListener("click", () => {
    const texto = (document.getElementById("protocoloIaTexto")?.textContent || "").trim();
    const ta = document.getElementById("protocoloDescricao");
    if (!texto) {
      toast("Não há sugestão para usar.");
      return;
    }
    if (ta?.value?.trim()) {
      toast("O campo já tem texto. Apague se quiser a sugestão da IA.");
      return;
    }
    if (ta) ta.value = texto;
    esconderPreviewIa();
    toast("Texto no campo. Confira e clique em Registrar. Preço e estoque não mudam sozinhos.");
  });

  document.getElementById("btnProtocoloIaDescartar")?.addEventListener("click", () => {
    esconderPreviewIa();
    toast("Sugestão descartada. Nada foi gravado.");
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
      const salvo = await createProtocoloAplicado({
        clientId: client.id,
        protocoloId: protocoloId || undefined,
        agendaId: agendaId || undefined,
        observacao,
        descricao,
        aplicado_em: aplicado_em || undefined,
        produtos_usados,
      });
      if (agendaId) sessionStorage.removeItem("clientePerfilAgendaId");
      if (salvo?.consumo_erros?.length) {
        toast("Prontuário salvo. O estoque não baixou: " + salvo.consumo_erros.join("; "), "warning");
      } else if (!produtos_usados.length) {
        toast("Registro salvo. Nenhum produto de estoque nesta sessão — confira se a baixa de material ficou de fora.");
      } else {
        toast("Registro salvo no prontuário do paciente.");
      }
      if (agendaId) {
        toast("Pagamento não é lançado sozinho. Na agenda desta sessão, use Dar baixa.", "info");
      }
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
  document.getElementById("btnRegistrarCombinado")?.addEventListener("click", () => openCombinadoModal(client));

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
  fotoCadastroWire?.fechar?.();
  fotoCadastroState.stream = null;
}

function openEditModal(client) {
  const cpfFormatted = formatCpfForInput(client.cpf || "");
  fotoCadastroState = { stream: null, blob: null, dataUrl: null };
  fotoCadastroIds = captureIds("editClient");

  openModal(
    "Editar cliente",
    `
    ${htmlFotoCadastro(fotoCadastroIds, { existingUrl: client.avatar_url || "" })}
    <label>Nome completo <span class="required">*</span></label>
    <input id="editName" required value="${escapeHtml(client.name || "")}" placeholder="Nome completo">
    <label class="field-label" for="editCpf">CPF</label>
    <input id="editCpf" type="text" value="${escapeHtml(cpfFormatted)}" placeholder="000.000.000-00" maxlength="14" inputmode="numeric" autocomplete="off">
    <label class="field-label" for="editPhone">Telefone</label>
    <input id="editPhone" type="tel" value="${escapeHtml(client.phone || "")}" placeholder="(00) 00000-0000" maxlength="15" inputmode="tel">
    <label>E-mail</label>
    <input id="editEmail" type="email" value="${escapeHtml(client.email || "")}" placeholder="email@exemplo.com">
    ${htmlEnderecoCliente("editClient", client)}
    <label>Data de nascimento</label>
    <input id="editBirthDate" type="date" value="${client.birth_date ? client.birth_date.slice(0, 10) : ""}">
    <label>Sexo</label>
    <select id="editSex">
      <option value="">—</option>
      <option value="F" ${client.sex === "F" ? "selected" : ""}>Feminino</option>
      <option value="M" ${client.sex === "M" ? "selected" : ""}>Masculino</option>
      <option value="Outro" ${client.sex === "Outro" ? "selected" : ""}>Outro</option>
    </select>
    <label>Relação comercial</label>
    <select id="editRelacaoComercial">
      <option value="" ${!client.relacao_comercial ? "selected" : ""}>Não definido</option>
      <option value="orcamento" ${client.relacao_comercial === "orcamento" ? "selected" : ""}>Só orçamento</option>
      <option value="comprou" ${client.relacao_comercial === "comprou" ? "selected" : ""}>Comprou</option>
      <option value="revenda" ${client.relacao_comercial === "revenda" ? "selected" : ""}>Revenda da clínica</option>
    </select>
    <label>Observações</label>
    <textarea id="editNotes" rows="2" placeholder="Opcional">${escapeHtml(client.notes || "")}</textarea>
    <p class="form-hint"><button type="button" class="btn-secondary" id="btnAgendarDoCadastro">Agendar horário para esta pessoa</button></p>
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
      const endereco = readEnderecoCliente("editClient");
      const photoFile = await photoFileFromCadastro(fotoCadastroIds, fotoCadastroState);
      fecharCameraEdit();

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
          ...endereco,
          relacao_comercial: document.getElementById("editRelacaoComercial")?.value || null,
          is_paciente_modelo: !!isPacienteModelo,
          model_discount_pct: model_discount_pct,
        };
        if (normalizedCpf !== undefined) updates.cpf = normalizedCpf || null;

        await updateClient(client.id, updates);

        let photoSigned = null;
        if (photoFile) {
          const orgId = getActiveOrg();
          if (orgId) {
            try {
              const uploaded = await uploadClientPhoto(orgId, client.id, photoFile);
              if (uploaded?.path) await updateClient(client.id, { avatar_url: uploaded.path });
              photoSigned = uploaded?.url || null;
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
        if (photoSigned && (!currentClient.avatar_url || !/^https?:\/\//i.test(String(currentClient.avatar_url)))) {
          currentClient = { ...currentClient, avatar_url: photoSigned };
        }
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

  bindCpfMask(document.getElementById("editCpf"));
  bindPhoneMask(document.getElementById("editPhone"));

  bindEnderecoCliente("editClient", toast);
  fotoCadastroWire = wireFotoCadastro(fotoCadastroIds, fotoCadastroState, toast);
  document.getElementById("btnAgendarDoCadastro")?.addEventListener("click", () => {
    closeModal();
    fecharCameraEdit();
    sessionStorage.setItem("agendaPrefillClientId", client.id);
    navigate("agenda");
    toast("Escolha o horário: a pessoa já vem selecionada.");
  });
}

function openCombinadoModal(client) {
  openModal(
    "Combinado da consulta",
    `
    <p class="client-hint">Só o que ficou combinado. Máximo 400 caracteres. Sem rascunho de IA. WhatsApp não sai daqui.</p>
    <label for="combinadoTexto">O que combinamos</label>
    <textarea id="combinadoTexto" rows="3" maxlength="400" required placeholder="Ex.: retorno em 15 dias"></textarea>
    <label for="combinadoRetorno">Retorno sugerido (opcional)</label>
    <input type="date" id="combinadoRetorno">
    `,
    async () => {
      const payload = payloadCombinadoConsulta({
        proximoPasso: document.getElementById("combinadoTexto")?.value,
        retornoEm: document.getElementById("combinadoRetorno")?.value,
      });
      if (!payload) {
        toast("Escreva o combinado. Texto vazio ou inválido não grava.");
        return;
      }
      try {
        await createClientEvent({ client_id: client.id, ...payload });
        toast("Combinado no prontuário.");
        closeModal();
        sessionStorage.setItem("clientePerfilOpenTab", "historico");
        await init();
      } catch (err) {
        toast(err?.message || "Erro ao gravar.");
      }
    }
  );
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
        sessionStorage.setItem("clientePerfilOpenTab", "historico");
        await init();
      } catch (err) {
        console.error(err);
        toast(err?.message || "Erro ao registrar evento");
      }
    }
  );
}
