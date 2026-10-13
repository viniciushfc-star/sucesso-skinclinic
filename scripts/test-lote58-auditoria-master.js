/**
 * Lote 58 — Auditoria no menu Gestão; plano e aplicado entram no log.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resumoMetadataAuditoria } from "../js/utils/audit-resumo.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 58 auditoria master", () => {
  it("Gestão tem Auditoria; Configurações não some para master", () => {
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    const gestao = html.slice(html.indexOf('id="gestaoSubmenu"'), html.indexOf('id="inteligenciaWrap"'));
    assert.match(gestao, /data-view="auditoria"/);
    assert.match(gestao, /data-view="financeiro"/);
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /auditoria:\s*\{[\s\S]*?permission:\s*"auditoria:view"/);
    const perm = readFileSync(join(ROOT, "js/core/permissions.js"), "utf8");
    assert.match(perm, /role === "master"/);
    assert.match(perm, /admin-only/);
    assert.doesNotMatch(perm, /if \(role !== "admin"\)/);
  });

  it("criar/editar plano e registrar aplicado gravam auditoria", () => {
    const planos = readFileSync(join(ROOT, "js/services/planos-terapeuticos.service.js"), "utf8");
    assert.match(planos, /action:\s*"plano\.create"/);
    assert.match(planos, /action:\s*"plano\.update"/);
    assert.match(planos, /action:\s*"plano\.delete"/);
    const proto = readFileSync(join(ROOT, "js/services/protocolo-db.service.js"), "utf8");
    const trecho = proto.slice(proto.indexOf("export async function createProtocoloAplicado"));
    assert.match(trecho, /action:\s*"protocolo\.aplicado"/);
    assert.match(trecho, /tableName:\s*"protocolos_aplicados"/);
  });

  it("lista mostra o que mudou e filtra plano / aplicado", () => {
    assert.equal(
      resumoMetadataAuditoria({ nome: "Oleosidade", procedure_ids_count: 2 }),
      "Nome: Oleosidade · 2 procedimento(s) no plano"
    );
    assert.equal(
      resumoMetadataAuditoria({ descricao: "Botox", produtos: ["Toxina"], agenda_id: "uuid-interno" }),
      "Feito: Botox · Produtos: Toxina"
    );
    assert.equal(resumoMetadataAuditoria({}), "");
    const logs = readFileSync(join(ROOT, "js/views/logs.views.js"), "utf8");
    assert.match(logs, /resumoMetadataAuditoria/);
    assert.match(logs, /plano:/);
    assert.match(logs, /action\.ilike\.%protocolo%/);
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(html, /value="plano"/);
  });
});
