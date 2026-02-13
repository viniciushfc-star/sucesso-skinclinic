/**
 * Modo tutorial — passo a passo para implementação e familiarização com o app.
 * Cada passo navega para uma view e exibe um cartão com título e texto.
 */

const STORAGE_KEY = "skinclinic_tutorial";
const STORAGE_KEY_DONE = "skinclinic_tutorial_done";

/** Passos do tutorial: view + título + texto */
export const TUTORIAL_STEPS = [
  {
    view: "dashboard",
    title: "Dashboard",
    body: "Aqui você vê o resumo do dia: quantidade de clientes, agenda e saldo. Use os filtros para mudar o período.",
  },
  {
    view: "clientes",
    title: "Clientes",
    body: "Cadastre seus clientes aqui. Use «Importar em lote» no topo para trazer muitos de uma vez por CSV.",
  },
  {
    view: "financeiro",
    title: "Custo fixo",
    body: "No Financeiro, use a aba «Custo fixo» para marcar os custos da clínica (aluguel, luz, etc.) e criar os lançamentos. Depois você ajusta na aba «Visão geral».",
    openTab: "custo-fixo",
  },
  {
    view: "agenda",
    title: "Agenda",
    body: "Onde você agenda atendimentos. Abaixo da lista do dia aparecem os aniversariantes; pode enviar mensagem ou oferta de brinde (configurável em Empresa).",
  },
  {
    view: "procedimento",
    title: "Procedimentos",
    body: "Cadastre cada serviço e o valor. Use o bloco «Apoio à precificação» ao criar/editar para sugerir preço com base em custo e margem.",
  },
  {
    view: "empresa",
    title: "Cadastro da empresa",
    body: "Nome, região, logo, endereço e CNPJ. Aqui você define também se o item Anamnese aparece no menu e se as mensagens de aniversário incluem oferta de brinde.",
  },
  {
    view: "financeiro",
    title: "Financeiro",
    body: "Registre entradas e saídas. Vincule transações a procedimentos para ver receita e margem por serviço. Use importar extrato (CSV) se preferir.",
  },
  {
    view: "para-clinicas",
    title: "Para clínicas",
    body: "Dúvidas frequentes e atalhos para as telas. Você pode iniciar este tutorial de novo a qualquer momento pelo menu.",
  },
];

export function getTotalSteps() {
  return TUTORIAL_STEPS.length;
}

export function getStep(index) {
  if (index < 0 || index >= TUTORIAL_STEPS.length) return null;
  return { index, ...TUTORIAL_STEPS[index] };
}

/** Retorna o último passo em que o usuário parou (0 se nunca fez). */
export function getSavedStep() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return 0;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0) return 0;
    return Math.min(n, TUTORIAL_STEPS.length - 1);
  } catch (_) {
    return 0;
  }
}

export function setSavedStep(index) {
  try {
    localStorage.setItem(STORAGE_KEY, String(index));
  } catch (_) {}
}

/** Marca o tutorial como concluído (para não forçar no primeiro acesso, só guardar preferência). */
export function markTutorialDone() {
  try {
    localStorage.setItem(STORAGE_KEY_DONE, "1");
  } catch (_) {}
}

export function wasTutorialDone() {
  try {
    return localStorage.getItem(STORAGE_KEY_DONE) === "1";
  } catch (_) {
    return false;
  }
}

/** Limpa o passo salvo e o “concluído” (útil para “Refazer tutorial”). */
export function resetTutorial() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_DONE);
  } catch (_) {}
}
