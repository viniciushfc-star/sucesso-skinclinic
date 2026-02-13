import { getMasterMetrics, getClinicsComparison } from "../services/metrics.service.js"

export async function init() {
  try {
    const m = await getMasterMetrics()
    const elClientes = document.getElementById("masterMClientes")
    const elAgenda = document.getElementById("masterMAgenda")
    const elSaldo = document.getElementById("masterMSaldo")
    if (elClientes) elClientes.textContent = m.clientes ?? "—"
    if (elAgenda) elAgenda.textContent = m.agendamentosHoje ?? "—"
    if (elSaldo) elSaldo.textContent = "R$ " + (m.faturamentoMes ?? 0).toFixed(2)

    await renderComparison()
  } catch (err) {
    console.error("[MASTER-DASH]", err)
    const elClientes = document.getElementById("masterMClientes")
    const elAgenda = document.getElementById("masterMAgenda")
    const elSaldo = document.getElementById("masterMSaldo")
    if (elClientes) elClientes.textContent = "—"
    if (elAgenda) elAgenda.textContent = "—"
    if (elSaldo) elSaldo.textContent = "—"
  }
}

async function renderComparison() {
  const body = document.getElementById("masterCompareTable")
  const wrap = document.getElementById("masterCompareWrap")
  if (!body) return
  try {
    const data = await getClinicsComparison()
    if (!data || data.length === 0) {
      if (wrap) wrap.classList.add("hidden")
      return
    }
    body.innerHTML = ""
    data.forEach((o) => {
      const tr = document.createElement("tr")
      tr.innerHTML = `
        <td>${escapeHtml(o.name || "—")}</td>
        <td>${o.clientes ?? "—"}</td>
        <td>R$ ${(o.faturamento ?? 0).toFixed(2)}</td>
      `
      body.appendChild(tr)
    })
    if (wrap) wrap.classList.remove("hidden")
  } catch (err) {
    console.error("[MASTER-DASH] compare", err)
    if (wrap) wrap.classList.add("hidden")
  }
}

function escapeHtml(s) {
  if (s == null) return ""
  const div = document.createElement("div")
  div.textContent = s
  return div.innerHTML
}

