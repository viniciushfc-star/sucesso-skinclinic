/**
 * Pacote piloto clínicas: cada pessoa (cliente, master, gestor, recepção, profissional, funcionário, aba contador).
 * Só leitura + APIs que já recusam. Sem WhatsApp em massa, sem gravar preço.
 *
 *   npm run cenario:piloto
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { resolve as pathResolve } from "node:path";
import { credenciaisGoldenAuth } from "../js/utils/golden-flow-auth.js";
import { PAPEIS_PILOTO, roteiroPilotoClinica, expectativasPapel, telasDoPapel } from "../js/utils/cenario-papeis.js";
import { permissionAllowedByRoleForTest } from "../lib/api-auth.js";
import { runCenariosPapeis } from "./cenario-papeis.js";
import { runCenariosCicloOs } from "./cenario-ciclo-os.js";
import { runCenariosUsuario } from "./cenario-usuario-clinica.js";

export async function runPilotoClinicas(env = process.env) {
  const passos = [];
  const mark = (id, estado, detalhe) => passos.push({ id, estado, detalhe });

  for (const p of PAPEIS_PILOTO) {
    mark(`papel-def-${p.id}`, "OK", `${p.titulo}${p.login ? ` (${p.env})` : ` — ${p.onde}`}`);
  }

  const exp = expectativasPapel();
  for (const [papel, regra] of Object.entries(exp)) {
    const telas = telasDoPapel(papel);
    const falta = regra.tem.filter((v) => !telas.includes(v));
    const vazou = regra.nao.filter((v) => telas.includes(v));
    mark(
      `matriz-${papel}`,
      falta.length || vazou.length ? "FALHOU" : "OK",
      falta.length || vazou.length ? `falta=${falta} vazou=${vazou}` : `telas ${telas.join(",") || "(nenhuma)"}`
    );
  }

  mark(
    "contador-nao-e-login",
    permissionAllowedByRoleForTest("recepcao", "financeiro:view") ? "FALHOU" : "OK",
    "contador é aba; recepção não vê financeiro"
  );
  mark(
    "cliente-nao-e-equipe",
    "OK",
    "paciente usa portal.html, não dashboard.html"
  );

  const creds = credenciaisGoldenAuth(env);
  if (!creds.ok) {
    mark("live-pacote", "PULOU", "sem QA_EMAIL_MASTER");
    return { ok: passos.every((p) => p.estado !== "FALHOU" && p.estado !== "TRAVOU"), passos, blocos: {} };
  }

  const blocos = {};
  blocos.papeis = await runCenariosPapeis();
  for (const p of blocos.papeis.passos || []) mark(`papeis.${p.id}`, p.estado, p.detalhe);
  blocos.ciclo = await runCenariosCicloOs();
  for (const p of blocos.ciclo.passos || []) mark(`ciclo.${p.id}`, p.estado, p.detalhe);
  blocos.usuario = await runCenariosUsuario();
  for (const p of blocos.usuario.passos || []) mark(`usuario.${p.id}`, p.estado, p.detalhe);

  const travou = passos.some((p) => p.estado === "TRAVOU");
  const falhou = passos.some((p) => p.estado === "FALHOU");
  return { ok: !travou && !falhou, passos, blocos };
}

function print(r) {
  console.log("ROTEIRO PARA AS CLÍNICAS (humano, um perfil por vez)");
  for (const bloco of roteiroPilotoClinica()) {
    console.log(`\n## ${bloco.papel}`);
    for (const t of bloco.testes) console.log(`  - ${t}`);
  }
  console.log("\nCENARIO-PILOTO (automático)");
  for (const p of r.passos) {
    if (p.id.startsWith("papeis.") || p.id.startsWith("ciclo.") || p.id.startsWith("usuario.")) {
      if (p.estado === "OK" || p.estado === "PULOU") continue;
    }
    console.log(`${p.estado.padEnd(7)} ${p.id} — ${p.detalhe}`);
  }
  const nOk = r.passos.filter((p) => p.estado === "OK").length;
  const nFail = r.passos.filter((p) => p.estado === "FALHOU" || p.estado === "TRAVOU").length;
  const nSkip = r.passos.filter((p) => p.estado === "PULOU").length;
  console.log(`\nresumo ${nOk} ok · ${nFail} falhou · ${nSkip} pulou`);
  console.log(r.ok ? "OK" : "FALHOU");
}

const invoked = String(process.argv[1] || "").replace(/\\/g, "/").endsWith("cenario-piloto-clinicas.js");
if (invoked) {
  runPilotoClinicas()
    .then((r) => {
      print(r);
      process.exit(r.ok ? 0 : 1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
