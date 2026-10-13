/**
 * Cenários de uso da clínica (dono/recepção). Só lógica pura — sem WhatsApp, sem preço.
 * O script ao vivo está em scripts/cenario-usuario-clinica.js.
 */

import { classificarSinalRadar } from "./crm-fila.js";
import { proximoPassoSetup } from "./golden-flow.js";

export const CENARIO_USUARIO_IDS = [
  "login_org",
  "hoje_agenda",
  "setup_primeiro_dia",
  "radar_retorno",
  "cliente_vazio",
  "orcamento_pacote",
  "espera_opcional",
];

/** Paciente nova, 20 dias, sem próximo horário → Sem 2º. */
export function cenarioNovaSemSegundo() {
  return classificarSinalRadar({ visits: 1, idleDays: 20, hasFuture: false });
}

/** Pacote com saldo e já tem sessão marcada → some do radar. */
export function cenarioPacoteJaAgendado() {
  return classificarSinalRadar({ packRest: 4, idleDays: 5, hasFuture: true, visits: 2 });
}

/** Ritmo ~21 dias, parada há 40, sem futuro → atrasada. */
export function cenarioAtrasadaRitmo() {
  return classificarSinalRadar({ visits: 5, idleDays: 40, medianGap: 21, hasFuture: false });
}

export function cenarioSetupEmpresaPendente() {
  return proximoPassoSetup([
    { id: "empresa", ok: false, view: "empresa", label: "Empresa" },
    { id: "equipe", ok: false, view: "team", label: "Equipe" },
  ]);
}

/**
 * Perfis de jornada. O runner ao vivo marca trava se passar de `timeoutMs`.
 */
export function roteiroUsuarioClinica() {
  return [
    { id: "login_org", titulo: "Entrar e escolher a clínica com pacientes", muta: false },
    { id: "hoje_agenda", titulo: "Abrir o dia: horários de hoje", muta: false },
    { id: "setup_primeiro_dia", titulo: "Ver o que falta para operar (setup)", muta: false },
    { id: "radar_retorno", titulo: "Radar: quem voltar a ligar (sem disparo)", muta: false },
    { id: "cliente_vazio", titulo: "Cadastro: clínica sem cliente não quebra a lista", muta: false },
    { id: "orcamento_pacote", titulo: "Orçamento/pacote: ler rascunhos e saldo", muta: false },
    { id: "espera_opcional", titulo: "Lista de espera (SQL leftover não pode travar)", muta: false },
  ];
}

export function withTimeout(promise, ms, nome) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`TRAVOU: ${nome} > ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}
