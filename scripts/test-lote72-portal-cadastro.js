/**
 * Lote 72 — link do portal atrelado ao cadastro da ficha; sem senha; sem WhatsApp automático.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  htmlCheckLinkPortalCadastro,
  querLinkPortalNoCadastro,
  htmlPortalLinkPronto,
} from "../js/utils/portal-link-cadastro.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 72 link do portal no cadastro", () => {
  it("checkbox vem ligado e o cartão cita a ficha, sem senha", () => {
    const html = htmlCheckLinkPortalCadastro();
    assert.match(html, /id="gerarLinkPortalCadastro"/);
    assert.match(html, /checked/);
    assert.match(html, /WhatsApp não sai daqui/);
    assert.equal(querLinkPortalNoCadastro(), true);
    const card = htmlPortalLinkPronto({ url: "https://ex/portal.html?token=abc", nome: "Ana" });
    assert.match(card, /Ana/);
    assert.match(card, /token=abc/);
    assert.match(card, /Sem senha/);
    assert.match(card, /não dispara mensagem/);
    assert.match(card, /btnCopiarLinkPortal/);
  });

  it("grava o paciente e gera sessão dele; perfil sempre tem o botão; sem WhatsApp e sem login", () => {
    const lista = readFileSync(join(ROOT, "js/views/clientes.views.js"), "utf8");
    assert.match(lista, /htmlCheckLinkPortalCadastro/);
    assert.match(lista, /querLinkPortalNoCadastro/);
    assert.match(lista, /createClientPortalSession\(client\.id\)/);
    assert.match(lista, /openModal/);
    assert.doesNotMatch(lista, /state === "pre_cadastro" && client\?\.id/);
    assert.doesNotMatch(lista, /sendWhatsapp/);
    const perfil = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(perfil, /id="btnEnviarLinkCadastro"/);
    assert.match(perfil, /mostrarLinkPortalCadastro/);
    const btnBlock = perfil.slice(
      perfil.indexOf('id="btnEnviarLinkCadastro"') - 180,
      perfil.indexOf('id="btnEnviarLinkCadastro"') + 80
    );
    assert.doesNotMatch(btnBlock, /pre_cadastro/);
    const portal = readFileSync(join(ROOT, "portal.html"), "utf8");
    assert.doesNotMatch(portal, /type="password"/);
    const boot = readFileSync(join(ROOT, "js/Client/portal.js"), "utf8");
    assert.match(boot, /params\.get\("token"\)/);
    assert.doesNotMatch(boot, /signInWithPassword/);
  });
});
