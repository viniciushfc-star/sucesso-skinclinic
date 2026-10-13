/**
 * Pagamento pelo app — jornada visível; cobrança só com parceria.
 */

import { PAGAMENTO_APP_ENABLED } from "../core/feature-flags.js";
import {
  PARCELAS_MAXIMAS,
  TAXA_APP_POR_PARCELA_PCT,
  TAXA_MERCADO_POR_PARCELA_PCT,
  DESCONTO_MAXIMO_PCT,
  textoComparativoTaxa,
  valorLiquidoApp,
} from "../core/pagamento-regras.js";
import {
  statusCobrancaApp,
  listarCobrancasApp,
  criarCobrancaApp,
  lancarCobrancaNoCaixa,
  lerAdesaoPagamento,
  registrarInteresseAdesao,
  SQL_COBRANCAS_APP,
} from "../services/pagamento-app.service.js";
import { toast } from "../ui/toast.js";
import { userFacingError } from "../core/errors.js";
import { JORNADA_COBRANCA, MSG_PARCERIA } from "../utils/pagamento-app.js";

function brl(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function htmlJornada() {
  return `
    <ol class="pagamento-jornada">
      ${JORNADA_COBRANCA.map(
        (p, i) => `<li>
          <span class="pagamento-jornada-n">${i + 1}</span>
          <div>
            <strong>${p.titulo}</strong>
            <p>${p.texto}</p>
          </div>
        </li>`
      ).join("")}
    </ol>
  `;
}

function htmlFormCobranca(ativa) {
  return `
    <form id="formCobrancaApp" class="pagamento-form">
      <fieldset ${ativa ? "" : "disabled"}>
        <legend>Quando a parceria ligar</legend>
        <label>Valor a cobrar (você informa)
          <input type="number" name="valor" min="0.01" step="0.01" required inputmode="decimal">
        </label>
        <label>Forma
          <select name="metodo">
            <option value="pix">PIX</option>
            <option value="credito">Cartão de crédito</option>
            <option value="debito">Cartão de débito</option>
          </select>
        </label>
        <label>Parcelas (só crédito)
          <input type="number" name="parcelas" min="1" max="${PARCELAS_MAXIMAS}" value="1">
        </label>
        <label>Descrição
          <input type="text" name="descricao" maxlength="200" placeholder="Ex.: sessão de limpeza">
        </label>
        <p id="pagamentoLiquidoHint" class="pagamento-actions-hint">${textoComparativoTaxa(1)} Desconto máx. ${DESCONTO_MAXIMO_PCT}% (só referência).</p>
        <button type="submit" class="btn-primary">${ativa ? "Pedir cobrança à maquininha" : "Ainda não cobra"}</button>
      </fieldset>
    </form>
  `;
}

export async function init() {
  const container = document.getElementById("pagamentoContent");
  if (!container) return;

  const [st, adesao] = await Promise.all([
    PAGAMENTO_APP_ENABLED ? statusCobrancaApp() : Promise.resolve({ ativa: false, motivo: MSG_PARCERIA }),
    lerAdesaoPagamento().catch(() => null),
  ]);
  const podeCobrar = !!(PAGAMENTO_APP_ENABLED && st.ativa);

  container.innerHTML = `
    <div class="pagamento-elab">
      <p class="pagamento-standby-badge">${podeCobrar ? "Parceria ligada" : "Aguardando parceria"}</p>
      <p class="pagamento-standby-text">Parceria com <strong>empresas de maquininha</strong>: elas trazem ofertas promocionais para quem usa o app. No mercado a oferta comum é <strong>${TAXA_MERCADO_POR_PARCELA_PCT}% por parcela</strong>; a taxa de uso no SkinClinic é <strong>${String(TAXA_APP_POR_PARCELA_PCT).replace(".", ",")}%</strong> — menor, para ser um ponto a favor. O paciente não paga a mais. Até a parceria fechar, o caixa de sempre continua.</p>
      ${htmlJornada()}
      <div class="pagamento-adesao" id="pagamentoAdesaoBox">
        ${
          adesao
            ? `<p class="pagamento-adesao-ok">Interesse anotado${adesao.via === "local" ? " neste aparelho" : ""}. Quando a parceria fechar, a cobrança liga aqui.</p>`
            : `<form id="formAdesaoPagamento">
                <p><strong>Quero entrar na parceria</strong> — não cobra ninguém agora.</p>
                <label>Faturamento mensal aproximado (opcional)
                  <input type="number" name="volume_mensal" min="0" step="100" inputmode="decimal" placeholder="Ex.: 80000">
                </label>
                <label>Recado (opcional)
                  <input type="text" name="recado" maxlength="400" placeholder="Ex.: já usamos maquininha X">
                </label>
                <button type="submit" class="btn-primary">Anotar interesse</button>
              </form>`
        }
      </div>
      ${htmlFormCobranca(podeCobrar)}
      <div id="listaCobrancasApp" class="pagamento-lista"></div>
      <p class="pagamento-standby-hint">${MSG_PARCERIA}</p>
    </div>
  `;

  bindAdesao();
  bindCobranca(podeCobrar);
  if (podeCobrar) await renderLista();
}

function bindAdesao() {
  const form = document.getElementById("formAdesaoPagamento");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await registrarInteresseAdesao({
        volume_mensal: fd.get("volume_mensal"),
        recado: fd.get("recado"),
      });
      toast("Anotamos o interesse. Ninguém foi cobrado.");
      const box = document.getElementById("pagamentoAdesaoBox");
      if (box) {
        box.innerHTML =
          "<p class=\"pagamento-adesao-ok\">Interesse anotado. Quando a parceria fechar, a cobrança liga aqui.</p>";
      }
    } catch (err) {
      const msg = userFacingError(err);
      toast(msg.includes("tabela") ? `Cole ${SQL_COBRANCAS_APP} no Supabase.` : msg, "error");
    }
  });
}

function bindCobranca(ativa) {
  const form = document.getElementById("formCobrancaApp");
  const hint = document.getElementById("pagamentoLiquidoHint");
  const valorEl = form?.querySelector("[name=valor]");
  const parcEl = form?.querySelector("[name=parcelas]");
  const atualizarHint = () => {
    const valor = Number(valorEl?.value);
    const parc = Number(parcEl?.value) || 1;
    if (!hint) return;
    const cmp = textoComparativoTaxa(parc);
    if (!Number.isFinite(valor) || valor <= 0) {
      hint.textContent = `${cmp} Desconto máx. ${DESCONTO_MAXIMO_PCT}% (só referência).`;
      return;
    }
    hint.textContent = `${cmp} Estimativa líquida (informativo): ${brl(valorLiquidoApp(valor, parc))}. Não grava preço.`;
  };
  valorEl?.addEventListener("input", atualizarHint);
  parcEl?.addEventListener("input", atualizarHint);
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ativa) {
      toast(MSG_PARCERIA, "error");
      return;
    }
    const fd = new FormData(form);
    try {
      await criarCobrancaApp({
        valor: fd.get("valor"),
        metodo: fd.get("metodo"),
        parcelas: fd.get("parcelas"),
        descricao: fd.get("descricao"),
        agenda_id: sessionStorage.getItem("cobrancaAgendaId") || null,
        client_id: sessionStorage.getItem("cobrancaClientId") || null,
      });
      toast("Pedido enviado à maquininha. Confirme no caixa quando cair.");
      await renderLista();
    } catch (err) {
      const msg = userFacingError(err);
      toast(msg.includes("tabela") ? `Cole ${SQL_COBRANCAS_APP} no Supabase.` : msg, "error");
    }
  });
}

async function renderLista() {
  const box = document.getElementById("listaCobrancasApp");
  if (!box) return;
  const rows = await listarCobrancasApp();
  if (!rows.length) {
    box.innerHTML = `<p class="pagamento-actions-hint">Nenhuma cobrança pelo app ainda.</p>`;
    return;
  }
  box.innerHTML = rows
    .map((c) => {
      const pago = c.status === "pago";
      return `<div class="item-card" data-id="${c.id}">
        <b>${brl(c.valor)}</b> · ${c.metodo || ""} · ${c.status || ""}
        <p>${c.descricao || ""}</p>
        ${pago ? "" : `<button type="button" class="btn-secondary btn-caixa-cobranca" data-id="${c.id}">Registrar no caixa</button>`}
      </div>`;
    })
    .join("");
  box.querySelectorAll(".btn-caixa-cobranca").forEach((btn) => {
    btn.onclick = async () => {
      const c = rows.find((x) => x.id === btn.dataset.id);
      if (!c) return;
      try {
        await lancarCobrancaNoCaixa(c);
        toast("Entrada no caixa registrada.");
        await renderLista();
      } catch (err) {
        toast(userFacingError(err), "error");
      }
    };
  });
}
