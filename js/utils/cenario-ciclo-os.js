/**
 * Cenários Clinic OS — o que testar (clínica + portal + programador).
 * Sem WhatsApp automático, sem preço sozinho, sem tela Atendimentos.
 */

import { resumoCicloOuroFicha, linhaCicloOuroCabecalho } from "./ciclo-ouro-ficha.js";
import { cartaoProximoPortal } from "./portal-jornada.js";
import { querLinkPortalNoCadastro } from "./portal-link-cadastro.js";
import { emailPortalNorm, senhaPortalOk } from "./portal-login.js";
import { payloadProtocoloIaFicha, temFonteParaIa } from "./protocolo-rascunho-ficha.js";

export function roteiroHumanoCicloOs() {
  return [
    {
      id: "h-cadastro-link",
      ator: "clínica",
      titulo: "Novo paciente: checkbox do portal ligado; ao salvar, copiar o link desta ficha",
      como: "Pacientes → Novo paciente. WhatsApp não sai sozinho.",
    },
    {
      id: "h-ficha-ciclo",
      ator: "clínica",
      titulo: "Abrir a ficha: Combinado / Receita / Feito na aba Dados",
      como: "Pacientes → Ver. Registrar feito abre Protocolo.",
    },
    {
      id: "h-ia-feito",
      ator: "clínica",
      titulo: "Protocolo: Sugerir com IA → Usar ou Descartar; só Registrar grava",
      como: "Precisa anamnese ou pele validada. Sem rascunho preliminar.",
    },
    {
      id: "h-agenda-vendeu",
      ator: "clínica",
      titulo: "Agenda: Ana vende, Bianca aplica — Profissional = Bianca, Quem vendeu = Ana",
      como: "Novo horário. Comissão de aplicar fica em Bianca; Financeiro mostra receita que fechou.",
    },
    {
      id: "h-camera",
      ator: "clínica",
      titulo: "Anamnese e estoque: câmera frontal e traseira",
      como: "Dois botões. Não grava sozinho.",
    },
    {
      id: "h-portal-link",
      ator: "paciente",
      titulo: "Abrir o link copiado: jornada ou completar cadastro",
      como: "portal.html?token=… — sem ia_preliminar.",
    },
    {
      id: "h-portal-senha",
      ator: "paciente",
      titulo: "No cadastro, e-mail + senha (8+) e repetir",
      como: "Opcional. Sem senha, só o link.",
    },
    {
      id: "h-portal-login",
      ator: "paciente",
      titulo: "portal.html sem token: e-mail e senha. Não é o login da equipe",
      como: "Senha errada não entra. Link antigo continua.",
    },
  ];
}

export function roteiroProgramadorCicloOs() {
  return [
    { id: "login_org", titulo: "JWT da clínica e org com pacientes", muta: false },
    { id: "sql_quem_vendeu", titulo: "Coluna sold_by_user_id na agenda", muta: false },
    { id: "sql_portal_login", titulo: "RPC login_client_portal recusa senha errada", muta: false },
    { id: "staff_nao_le_hash", titulo: "Staff não lê hash de senha da paciente", muta: false },
    { id: "ficha_ciclo_live", titulo: "Ler um paciente: aplicados não misturam com plano", muta: false },
  ];
}

/** Ana vendeu, Bianca aplica: slot e comissão. */
export function cenarioAnaVendeBiancaAplica() {
  const slot = { user_id: "bianca", sold_by_user_id: "ana", procedimento: "Harmonização" };
  const aplica = slot.user_id;
  const vendeu = slot.sold_by_user_id || slot.user_id;
  return {
    slot,
    aplica,
    vendeu,
    misturou: aplica === vendeu,
    pagaSozinho: false,
  };
}

export function cenarioMesmaPessoaVendeEAplica() {
  const slot = { user_id: "bianca", sold_by_user_id: null };
  return {
    aplica: slot.user_id,
    vendeu: slot.sold_by_user_id || slot.user_id,
  };
}

export function cenarioCicloOleosidadeFeito() {
  const resumo = resumoCicloOuroFicha({
    planosCliente: [{ nome: "Oleosidade", sessoes: [{ id: "a1", procedimento: "Limpeza" }] }],
    protocolos: [{ id: "p1", nome: "Limpeza profunda" }],
    aplicados: [{ agenda_id: "a1", protocolo_id: "p1", protocolos: { nome: "Limpeza profunda" }, descricao: "Sessão 1" }],
  });
  const linha = linhaCicloOuroCabecalho(resumo);
  return { resumo, linha };
}

export function cenarioIaSemPreliminar() {
  const payload = payloadProtocoloIaFicha({
    anamnese: [],
    analises: [{ ia_preliminar: "SEGREDO" }],
  });
  return { payload, temFonte: temFonteParaIa(payload) };
}

export function cenarioPortalProximoHorario() {
  return cartaoProximoPortal({
    today: "2026-10-12",
    cadastroCompleto: true,
    sessoes: [{ data: "2026-10-20", hora: "14:00:00", procedimento: "Limpeza" }],
  });
}

export function cenarioLinkPadraoNoCadastro() {
  return querLinkPortalNoCadastro();
}

export function cenarioSenhaPortal() {
  return {
    curta: senhaPortalOk("1234567"),
    ok: senhaPortalOk("clinic@12"),
    espaco: senhaPortalOk("1234 5678"),
    email: emailPortalNorm("  Ana@Ex.com "),
  };
}
