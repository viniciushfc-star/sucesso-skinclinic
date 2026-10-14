/**
 * Orçamento comercial: totais e texto para WhatsApp.
 * Não altera preço; o valor da linha é o que a clínica digitou.
 */

import { eRepresentacao, marcaRepresentada } from "./produto-posse.js";

export function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function linhaTotal(item) {
  const qty = Number(item?.qty);
  const price = Number(item?.unit_price);
  const q = Number.isFinite(qty) && qty > 0 ? qty : 0;
  const p = Number.isFinite(price) && price >= 0 ? price : 0;
  return round2(q * p);
}

export function totalOrcamento(items) {
  return round2((items || []).reduce((s, it) => s + linhaTotal(it), 0));
}

export function brl(n) {
  return "R$ " + round2(n).toFixed(2).replace(".", ",");
}

export function hojeOrcamentoIso(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Venceu a validade e ainda não fechou. Não grava status no banco (CHECK atual não tem expirado). */
export function isOrcamentoExpirado(o, hoje = hojeOrcamentoIso()) {
  const s = String(o?.status || "").toLowerCase();
  if (s === "aceito" || s === "recusado" || s === "convertido") return false;
  const v = String(o?.valid_until || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  return v < String(hoje).slice(0, 10);
}

export function statusEfetivoOrcamento(o, hoje = hojeOrcamentoIso(), extra = {}) {
  if (isOrcamentoExpirado(o, hoje)) return "expirado";
  const s = String(o?.status || "rascunho").toLowerCase() || "rascunho";
  if (s === "aceito" && Number(extra.packagesCount) > 0) return "convertido";
  if (s === "enviado" && extra.visto) return "visualizado";
  return s;
}

export function statusOrcamentoLabel(status) {
  const map = {
    rascunho: "Rascunho",
    enviado: "Enviado",
    visualizado: "Visualizado",
    aceito: "Aceito",
    recusado: "Recusado",
    expirado: "Expirado",
    convertido: "Convertido",
  };
  return map[status] || status || "—";
}

export const PREFIXO_ORCAMENTO_VISTO = "orcamento_visto:";

export function payloadOrcamentoVisto(orcamentoId) {
  const id = String(orcamentoId || "").trim();
  if (!id) return null;
  return {
    event_type: "orcamento_visto",
    description: `${PREFIXO_ORCAMENTO_VISTO}${id}`,
    is_critical: false,
    created_by_client: false,
  };
}

export function idsOrcamentosVistos(events) {
  const ids = new Set();
  const prefix = PREFIXO_ORCAMENTO_VISTO;
  for (const e of events || []) {
    if (String(e.event_type || "") !== "orcamento_visto") continue;
    const d = String(e.description || "");
    if (d.startsWith(prefix)) ids.add(d.slice(prefix.length));
  }
  return ids;
}

export function contarPacotesPorOrcamento(pacotes) {
  const map = {};
  for (const p of pacotes || []) {
    const id = p.orcamento_id;
    if (!id) continue;
    map[id] = (map[id] || 0) + 1;
  }
  return map;
}

export function kindLinhaOrcamento(item) {
  const k = String(item?.kind || "").toLowerCase();
  if (k === "produto") return "produto";
  if (k === "servico" || k === "serviço") return "servico";
  if (item?.product_id) return "produto";
  return "servico";
}

export function soProdutoOrcamento(items) {
  const list = (items || []).filter((it) => String(it.name || "").trim());
  return list.length > 0 && list.every((it) => kindLinhaOrcamento(it) === "produto");
}

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function validadePt(validUntil) {
  const v = String(validUntil || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  return v.split("-").reverse().join("/");
}

function linhasMensagem(items) {
  return (items || [])
    .filter((it) => String(it.name || "").trim())
    .map((it) => {
      const qty = Number(it.qty) > 0 ? Number(it.qty) : 1;
      return `• ${String(it.name).trim()} × ${qty} — ${brl(linhaTotal(it))}`;
    });
}

/**
 * Mensagem pronta para wa.me / API. Um paciente por vez. Sem custo, margem ou parcela.
 */
export function formatOrcamentoMensagem({
  nomeClinica,
  nomeCliente,
  items,
  notes,
  validUntil,
} = {}) {
  const list = (items || []).filter((it) => String(it.name || "").trim());
  const temKind = list.some((it) => it.kind === "produto" || it.kind === "servico" || it.product_id);
  let corpo;
  if (temKind) {
    const serv = linhasMensagem(list.filter((it) => kindLinhaOrcamento(it) !== "produto"));
    const prodClin = linhasMensagem(list.filter((it) => kindLinhaOrcamento(it) === "produto" && !eRepresentacao(it.posse)));
    const prodRep = linhasMensagem(list.filter((it) => kindLinhaOrcamento(it) === "produto" && eRepresentacao(it.posse)));
    const blocos = [];
    if (serv.length) blocos.push(`Serviços\n${serv.join("\n")}`);
    if (prodClin.length) blocos.push(`Produtos da clínica\n${prodClin.join("\n")}`);
    if (prodRep.length) blocos.push(`Representação\n${prodRep.join("\n")}`);
    corpo = blocos.join("\n") || "• (itens a combinar)";
  } else {
    corpo = linhasMensagem(list).join("\n") || "• (itens a combinar)";
  }
  const total = totalOrcamento(items);
  const validade = validadePt(validUntil) ? `\nValidade: ${validadePt(validUntil)}` : "";
  const obs = notes && String(notes).trim() ? `\nObs.: ${String(notes).trim()}` : "";
  const quem = nomeCliente ? `${nomeCliente}, segue` : "Segue";
  const clinica = nomeClinica ? `\n${nomeClinica}` : "";
  return `${quem} o orçamento:\n${corpo}\nTotal: ${brl(total)}${validade}${obs}${clinica}`;
}

/**
 * HTML da proposta para imprimir / PDF. Sem custo interno, margem ou maquininha.
 */
export function htmlPropostaOrcamento({
  nomeClinica,
  logoUrl,
  endereco,
  telefone,
  nomeCliente,
  items,
  notes,
  validUntil,
} = {}) {
  const clinica = escHtml(nomeClinica || "Clínica");
  const cliente = escHtml(nomeCliente || "Cliente");
  const logo = String(logoUrl || "").trim();
  const logoOk = /^(https?:|\/|\.\/|data:image\/)/i.test(logo);
  const logoHtml = logoOk
    ? `<img class="proposta-logo" src="${escHtml(logo)}" alt="">`
    : "";
  const contato = [endereco, telefone].filter((x) => String(x || "").trim()).map(escHtml).join(" · ");
  const rows = (items || [])
    .filter((it) => String(it.name || "").trim())
    .map((it) => {
      const qty = Number(it.qty) > 0 ? Number(it.qty) : 1;
      const tipo = (() => {
        if (kindLinhaOrcamento(it) !== "produto") return "Serviço";
        if (eRepresentacao(it.posse)) {
          const marca = marcaRepresentada(it.marca_representada);
          return marca ? `Produto · Representação · ${marca}` : "Produto · Representação";
        }
        return "Produto da clínica";
      })();
      return `<tr>
        <td>${escHtml(it.name)}<span class="proposta-tipo"> ${tipo}</span></td>
        <td class="num">${qty}</td>
        <td class="num">${brl(it.unit_price)}</td>
        <td class="num">${brl(linhaTotal(it))}</td>
      </tr>`;
    })
    .join("");
  const validade = validadePt(validUntil);
  const obs = notes && String(notes).trim()
    ? `<p class="proposta-obs">${escHtml(notes)}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Proposta — ${cliente}</title>
<style>
  :root { --teal:#0f5c62; --paper:#f7f4ee; --ink:#1c1917; --muted:#57534e; --line:#e7e0d6; }
  * { box-sizing:border-box; }
  body { margin:0; padding:32px; font-family:Georgia,"Times New Roman",serif; color:var(--ink); background:#fff; }
  .folha { max-width:720px; margin:0 auto; }
  header { display:flex; gap:16px; align-items:center; border-bottom:2px solid var(--teal); padding-bottom:16px; }
  .proposta-logo { width:64px; height:64px; object-fit:contain; border-radius:8px; }
  h1 { font-size:22px; margin:0; color:var(--teal); font-weight:700; letter-spacing:0.02em; }
  .contato { font-size:13px; color:var(--muted); margin-top:4px; font-family:system-ui,sans-serif; }
  h2 { font-size:16px; font-weight:600; margin:28px 0 8px; }
  .para { font-family:system-ui,sans-serif; font-size:14px; color:var(--muted); }
  table { width:100%; border-collapse:collapse; margin-top:12px; font-family:system-ui,sans-serif; font-size:14px; }
  th { text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--muted); border-bottom:1px solid var(--line); padding:8px 6px; }
  td { padding:10px 6px; border-bottom:1px solid var(--line); }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  .proposta-tipo { display:block; font-size:11px; color:var(--muted); font-weight:500; }
  .total { display:flex; justify-content:flex-end; margin-top:16px; font-size:18px; font-weight:700; color:var(--teal); font-family:system-ui,sans-serif; }
  .proposta-obs { margin-top:20px; font-size:14px; white-space:pre-wrap; }
  .validade { margin-top:8px; font-family:system-ui,sans-serif; font-size:13px; color:var(--muted); }
  footer { margin-top:36px; font-family:system-ui,sans-serif; font-size:11px; color:var(--muted); border-top:1px solid var(--line); padding-top:12px; }
  @media print { body { padding:12px; } }
</style>
</head>
<body>
  <div class="folha">
    <header>
      ${logoHtml}
      <div>
        <h1>${clinica}</h1>
        ${contato ? `<p class="contato">${contato}</p>` : ""}
      </div>
    </header>
    <p class="para">Proposta para</p>
    <h2>${cliente}</h2>
    ${validade ? `<p class="validade">Válida até ${escHtml(validade)}</p>` : ""}
    <table>
      <thead>
        <tr><th>Item</th><th class="num">Qtd</th><th class="num">Unitário</th><th class="num">Total</th></tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="4">Itens a combinar</td></tr>`}
      </tbody>
    </table>
    <p class="total">Total ${brl(totalOrcamento(items))}</p>
    ${obs}
    <footer>Proposta comercial. O valor é o combinado aqui — o catálogo não muda sozinho. Confira com a clínica antes de pagar.</footer>
  </div>
  <script>window.onload=function(){window.print();};</script>
</body>
</html>`;
}
