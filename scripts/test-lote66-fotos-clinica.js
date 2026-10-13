/**
 * Lote 66 — foto do paciente, câmera da anamnese, foto do produto.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { htmlClientAvatar, initialsFromName } from "../js/utils/cliente-cadastro.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 66 fotos na clínica", () => {
  it("iniciais só somem quando a foto tem tamanho real", () => {
    assert.equal(initialsFromName("Marta Passos"), "MP");
    const html = htmlClientAvatar("https://cdn.example/a.png?x=1&y=2", "Marta Passos");
    assert.match(html, /naturalWidth<8/);
    assert.match(html, /clientes-avatar-initials/);
    assert.doesNotMatch(html, /avatar-initials hidden/);
    assert.match(html, /&amp;y=2/);
    assert.match(readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8"), /htmlClientAvatar\(/);
    assert.match(readFileSync(join(ROOT, "js/views/clientes.views.js"), "utf8"), /htmlClientAvatar\(/);
  });

  it("anamnese e cadastro oferecem frontal e traseira", () => {
    const view = readFileSync(join(ROOT, "js/views/anamnese.views.js"), "utf8");
    const cad = readFileSync(join(ROOT, "js/utils/cliente-cadastro.js"), "utf8");
    const cam = readFileSync(join(ROOT, "js/utils/camera.js"), "utf8");
    const dash = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(view, /dataset\.facing/);
    assert.match(view, /anamneseFotosAntesCamUser/);
    assert.match(view, /anamneseFotosAntesCamEnv/);
    assert.match(dash, /data-facing="user"/);
    assert.match(dash, /data-facing="environment"/);
    assert.match(dash, /capture="user"/);
    assert.match(dash, /capture="environment"/);
    assert.match(dash, /Câmera frontal/);
    assert.match(dash, /Câmera traseira/);
    assert.match(cad, /btnTirarEnv/);
    assert.match(cad, /Câmera frontal/);
    assert.match(cam, /Usar traseira/);
    assert.match(cam, /opts\.facing/);
    assert.match(readFileSync(join(ROOT, "js/ui/modal.js"), "utf8"), /hideSubmit/);
  });

  it("produto do estoque aceita câmera frontal, traseira e cola", () => {
    const est = readFileSync(join(ROOT, "js/views/estoque.views.js"), "utf8");
    assert.match(est, /estoqueCatFotoCamUser/);
    assert.match(est, /estoqueCatFotoCamEnv/);
    assert.match(est, /fileFromClipboardEvent/);
    assert.match(est, /Câmera frontal/);
    assert.match(readFileSync(join(ROOT, "dashboard.html"), "utf8"), /style\.css\?v=/);
  });
});
