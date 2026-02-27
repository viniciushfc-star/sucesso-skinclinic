/**
 * Relatório para o contador: resumo mastigado por cliente (um bloco por cliente)
 * para facilitar negociação: mais clientes com valor menor, sem ocupar tanto tempo.
 */

import { withOrg, getActiveOrg } from "../core/org.js";
import { supabase } from "../core/supabase.js";
import { getClientes } from "./clientes.service.js";
import { getFinanceiro } from "./financeiro.service.js";

/**
 * Retorna resumo por cliente no período (atendimentos na agenda) e totais financeiros.
 * @param {string} dataInicio - YYYY-MM-DD
 * @param {string} dataFim - YYYY-MM-DD
 * @param {{ limiteClientes?: number }} opts - limiteClientes: máximo de clientes no relatório (null = todos)
 * @returns {Promise<{ clientes: Array<{ nome, cpf, email, atendimentos }>, totais: { entradas, saidas, clientesAtivos }, periodo }} 
 */
export async function getRelatorioContador(dataInicio, dataFim, opts = {}) {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização não selecionada");

  const limite = opts.limiteClientes != null ? Math.max(0, Number(opts.limiteClientes)) : null;

  const [agendaRows, financeiro, clientesList] = await Promise.all([
    withOrg(
      supabase
        .from("agenda")
        .select("cliente_id")
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .not("cliente_id", "is", null)
    ).then((r) => {
      if (r.error) throw r.error;
      return r.data || [];
    }),
    getFinanceiro(),
    getClientes({}),
  ]);

  const clientesById = (clientesList || []).reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {});

  const atendimentosPorCliente = {};
  for (const row of agendaRows) {
    const id = row.cliente_id;
    if (!id) continue;
    atendimentosPorCliente[id] = (atendimentosPorCliente[id] || 0) + 1;
  }

  let clientIds = Object.keys(atendimentosPorCliente);
  clientIds.sort((a, b) => atendimentosPorCliente[b] - atendimentosPorCliente[a]);
  if (limite != null && limite > 0) clientIds = clientIds.slice(0, limite);

  const clientes = clientIds.map((id) => {
    const c = clientesById[id];
    return {
      nome: c?.name || "—",
      cpf: c?.cpf || "—",
      email: c?.email || "—",
      atendimentos: atendimentosPorCliente[id] || 0,
    };
  });

  const entradas = (financeiro || [])
    .filter((f) => f.tipo === "entrada" && f.data >= dataInicio && f.data <= dataFim)
    .reduce((s, f) => s + (Number(f.valor_recebido ?? f.valor) || 0), 0);
  const saidas = (financeiro || [])
    .filter((f) => f.tipo === "saida" && f.data >= dataInicio && f.data <= dataFim)
    .reduce((s, f) => s + (Number(f.valor) || 0), 0);

  return {
    clientes,
    totais: {
      entradas,
      saidas,
      clientesAtivos: clientIds.length,
    },
    periodo: { dataInicio, dataFim },
  };
}
