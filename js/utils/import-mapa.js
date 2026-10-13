/**
 * Mapa de colunas da planilha → campos do SkinClinic.
 * Humano confirma. Sem IA, sem WhatsApp, sem gravar na leitura.
 */

export function normalizarCabecalho(h) {
  return String(h ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function detectarSeparador(primeiraLinha) {
  const line = String(primeiraLinha || "");
  const tabs = (line.match(/\t/g) || []).length;
  const semi = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  if (tabs >= semi && tabs >= comma && tabs > 0) return "\t";
  if (semi >= comma && semi > 0) return ";";
  if (comma > 0) return ",";
  return ";";
}

/** Campos que o lote entende, por tipo. */
export function camposDestino(tipo) {
  const t = String(tipo || "clientes");
  if (t === "procedimentos") {
    return [
      { id: "nome", label: "Nome do procedimento", required: true, aliases: ["nome", "name", "procedimento", "servico", "tratamento"] },
      { id: "descricao", label: "Descrição", required: false, aliases: ["descricao", "description", "obs"] },
      { id: "duracao_minutos", label: "Duração (min)", required: false, aliases: ["duracao_minutos", "duration_minutes", "duracao", "minutos", "tempo"] },
      { id: "valor_cobrado", label: "Preço cobrado", required: false, aliases: ["valor_cobrado", "valor", "preco", "preco_venda", "price"] },
      { id: "custo_material_estimado", label: "Custo material", required: false, aliases: ["custo_material_estimado", "custo_material", "custo"] },
    ];
  }
  if (t === "financeiro" || t === "custo_fixo") {
    return [
      { id: "data", label: "Data", required: true, aliases: ["data", "date", "dt", "competencia"] },
      { id: "valor", label: "Valor", required: true, aliases: ["valor", "value", "quantia", "rs"] },
      { id: "tipo", label: "Tipo (entrada/saída)", required: false, aliases: ["tipo", "type", "natureza"] },
      { id: "descricao", label: "Descrição", required: false, aliases: ["descricao", "historico", "desc", "memo", "lancamento"] },
      { id: "categoria_saida", label: "Categoria", required: false, aliases: ["categoria_saida", "categoria", "category"] },
      { id: "conta_origem", label: "Conta", required: false, aliases: ["conta_origem", "conta", "banco"] },
    ];
  }
  if (t === "agenda") {
    return [
      { id: "data", label: "Data", required: true, aliases: ["data", "date", "dia"] },
      { id: "hora", label: "Hora", required: true, aliases: ["hora", "horario", "time", "inicio"] },
      { id: "cliente", label: "Paciente", required: false, aliases: ["cliente", "client", "nome_cliente", "paciente", "nome"] },
      { id: "procedimento", label: "Procedimento", required: false, aliases: ["procedimento", "procedure", "servico", "tratamento"] },
      { id: "duracao_minutos", label: "Duração (min)", required: false, aliases: ["duracao_minutos", "duration", "duracao"] },
    ];
  }
  return [
    { id: "nome", label: "Nome", required: true, aliases: ["nome", "name", "cliente", "paciente", "nome_completo", "full_name"] },
    { id: "telefone", label: "Telefone / WhatsApp", required: false, aliases: ["telefone", "phone", "celular", "whatsapp", "tel", "fone", "contato"] },
    { id: "email", label: "E-mail", required: false, aliases: ["email", "e_mail", "mail"] },
    { id: "cpf", label: "CPF", required: false, aliases: ["cpf", "documento"] },
    { id: "data_nascimento", label: "Nascimento", required: false, aliases: ["data_nascimento", "nascimento", "birth_date", "aniversario"] },
    { id: "observacoes", label: "Observações", required: false, aliases: ["observacoes", "notes", "obs", "anotacao"] },
  ];
}

export function sugerirMapa(headers, tipo) {
  const campos = camposDestino(tipo);
  const norms = (headers || []).map((h) => ({ raw: h, n: normalizarCabecalho(h) }));
  const used = new Set();
  const mapa = {};
  for (const c of campos) {
    const hit = norms.find((h) => {
      if (used.has(h.raw)) return false;
      return c.aliases.some((a) => h.n === a || h.n.includes(a) || a.includes(h.n));
    });
    mapa[c.id] = hit ? hit.raw : "";
    if (hit) used.add(hit.raw);
  }
  return mapa;
}

export function faltandoObrigatorios(mapa, tipo) {
  return camposDestino(tipo)
    .filter((c) => c.required && !String(mapa?.[c.id] || "").trim())
    .map((c) => c.label);
}

export function aplicarMapa(rowsBrutas, mapa) {
  const m = mapa || {};
  return (rowsBrutas || []).map((row) => {
    const out = {};
    for (const dest of Object.keys(m)) {
      const src = m[dest];
      if (!src) continue;
      out[dest] = row[src] ?? row[normalizarCabecalho(src)] ?? "";
    }
    return out;
  });
}

function splitLinha(line, sep) {
  if (sep === "\t") return line.split("\t").map((p) => p.replace(/^"|"$/g, "").trim());
  return line.split(sep).map((p) => p.replace(/^"|"$/g, "").trim());
}

/**
 * CSV, planilha colada do Excel/Sheets (tab) ou ; ,
 * Não grava. Primeira linha = cabeçalho original.
 */
export function parsePlanilhaTexto(texto) {
  const lines = String(texto || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [], sep: ";" };
  const sep = detectarSeparador(lines[0]);
  const headersRaw = splitLinha(lines[0], sep).filter((h) => h !== "");
  if (!headersRaw.length) return { headers: [], rows: [], sep };
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = splitLinha(lines[i], sep);
    const obj = {};
    headersRaw.forEach((h, j) => {
      obj[h] = parts[j] ?? "";
    });
    rows.push(obj);
  }
  return { headers: headersRaw, rows, sep };
}

export function htmlMapaColunas(tipo, headers, mapa) {
  const campos = camposDestino(tipo);
  const m = mapa || sugerirMapa(headers, tipo);
  const linhas = campos
    .map((c) => {
      const sel = m[c.id] || "";
      const req = c.required ? " *" : "";
      const opts = (headers || [])
        .map((h) => `<option value="${escapeAttr(h)}"${h === sel ? " selected" : ""}>${escapeHtml(h)}</option>`)
        .join("");
      return `<label class="import-mapa-row">
        <span>${escapeHtml(c.label)}${req}</span>
        <select data-dest="${escapeAttr(c.id)}" aria-label="${escapeAttr(c.label)}">
          <option value="">— ignorar —</option>
          ${opts}
        </select>
      </label>`;
    })
    .join("");
  return `<div class="import-mapa" id="importMapa">
    <p class="import-mapa-title">Esta coluna da planilha é…</p>
    <p class="view-hint">Confira o mapa. Nada grava até Importar. WhatsApp não sai daqui.</p>
    ${linhas}
  </div>`;
}

export function lerMapaDoDom(root) {
  const mapa = {};
  (root?.querySelectorAll("select[data-dest]") || []).forEach((el) => {
    mapa[el.dataset.dest] = el.value || "";
  });
  return mapa;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}
