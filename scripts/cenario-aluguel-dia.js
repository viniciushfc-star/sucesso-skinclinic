/**
 * Monta o cenário “dia de HIFU” na org QA (aluguel por dia) e confere a conta.
 * Não altera o preço se o procedimento já tiver valor.
 *
 *   node scripts/cenario-aluguel-dia.js
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  credenciaisGoldenAuth,
  escolherOrgComPacientes,
} from "../js/utils/golden-flow-auth.js";
import {
  CENARIO_DIA_HIFU,
  contaDiaEquipamento,
  parseAluguelCadastro,
  textoContaDia,
  withAluguelMarker,
} from "../js/utils/aluguel-dia.js";

function brl(n) {
  return `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
}

function relatar(c, titulo) {
  console.log(`\n=== ${titulo} ===`);
  console.log(textoContaDia(c, { nomeProc: CENARIO_DIA_HIFU.nome }));
  console.log(
    JSON.stringify(
      {
        contribuicao: c.contribuicao,
        nPagar: c.nPagar,
        nSobra: c.nSobra,
        capacidade: c.capacidade,
        pagaNoDia: c.pagaNoDia,
        lotado: c.lotado,
      },
      null,
      2
    )
  );
}

async function main() {
  const local = contaDiaEquipamento(CENARIO_DIA_HIFU);
  const comComissao = contaDiaEquipamento({ ...CENARIO_DIA_HIFU, comissaoPct: 20 });
  relatar(local, "Conta local — dona atende (sem comissão)");
  relatar(comComissao, "Conta local — profissional 20%");

  if (local.nPagar !== 2 || local.nSobra !== 4 || local.lotado?.lucro !== 2656) {
    throw new Error("Conta local do cenário HIFU divergiu.");
  }

  const creds = credenciaisGoldenAuth();
  if (!creds.ok) {
    console.log("\nSem QA_EMAIL_MASTER — só a conta local rodou.");
    return;
  }

  const db = createClient(creds.url, creds.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error: loginErr } = await db.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (loginErr || !session?.session) {
    throw new Error(loginErr?.message || "login QA falhou");
  }

  const pick = await escolherOrgComPacientes(db);
  if (!pick.ok) throw new Error(pick.detalhe || "sem org");
  const orgId = pick.orgId;

  const { data: orgs } = await db.from("organizations").select("id, name").eq("id", orgId);
  const orgNome = orgs?.[0]?.name || orgId;
  console.log(`\nOrg: ${orgNome} (${orgId}) · ${pick.clientes} pacientes`);

  const { data: procs, error: listErr } = await db
    .from("procedures")
    .select("id, name, description, duration_minutes, valor_cobrado, custo_material_estimado, margem_minima_desejada, comissao_profissional_pct")
    .eq("org_id", orgId)
    .order("name");
  if (listErr) throw listErr;

  let proc = (procs || []).find((p) => String(p.name || "").toLowerCase() === CENARIO_DIA_HIFU.nome.toLowerCase());
  if (!proc) {
    proc = (procs || []).find((p) => /hifu|ultrassom microfocado/i.test(p.name || ""));
  }

  const markerCfg = {
    dia: CENARIO_DIA_HIFU.aluguelDia,
    horas: CENARIO_DIA_HIFU.horasDia,
    equip: CENARIO_DIA_HIFU.equip,
  };

  if (!proc) {
    const payload = {
      org_id: orgId,
      name: CENARIO_DIA_HIFU.nome,
      duration_minutes: CENARIO_DIA_HIFU.durationMinutes,
      valor_cobrado: CENARIO_DIA_HIFU.preco,
      custo_material_estimado: CENARIO_DIA_HIFU.material,
      margem_minima_desejada: CENARIO_DIA_HIFU.margemAlvoPct,
      description: withAluguelMarker("Dia de aparelho alugado (cenário QA).", markerCfg),
      active: true,
    };
    const ins = await db.from("procedures").insert(payload).select("id, name, description, duration_minutes, valor_cobrado, custo_material_estimado, margem_minima_desejada").single();
    if (ins.error) throw ins.error;
    proc = ins.data;
    console.log(`Criado procedimento ${proc.name} (${proc.id}) com valor ${brl(proc.valor_cobrado)}.`);
  } else {
    const precoAntes = proc.valor_cobrado;
    const desc = withAluguelMarker(proc.description, markerCfg);
    const patch = { description: desc };
    if (proc.custo_material_estimado == null) patch.custo_material_estimado = CENARIO_DIA_HIFU.material;
    if (proc.margem_minima_desejada == null) patch.margem_minima_desejada = CENARIO_DIA_HIFU.margemAlvoPct;
    if (proc.valor_cobrado == null || Number(proc.valor_cobrado) <= 0) {
      patch.valor_cobrado = CENARIO_DIA_HIFU.preco;
    }
    const upd = await db.from("procedures").update(patch).eq("id", proc.id).eq("org_id", orgId).select("id, name, description, duration_minutes, valor_cobrado, custo_material_estimado, margem_minima_desejada, comissao_profissional_pct").single();
    if (upd.error) throw upd.error;
    proc = upd.data;
    if (precoAntes != null && Number(precoAntes) > 0 && Number(proc.valor_cobrado) !== Number(precoAntes)) {
      throw new Error(`Preço mudou de ${precoAntes} para ${proc.valor_cobrado} — abortado.`);
    }
    console.log(`Atualizado ${proc.name} (${proc.id}). Preço cobrado: ${proc.valor_cobrado != null ? brl(proc.valor_cobrado) : "não informado"} (não forçado se já existia).`);
  }

  const lido = parseAluguelCadastro(proc);
  if (!lido || lido.dia !== 800 || lido.equip !== "HIFU") {
    throw new Error(`Marcador não voltou na ficha: ${JSON.stringify(lido)}`);
  }

  const aoVivo = contaDiaEquipamento({
    aluguelDia: lido.dia,
    preco: proc.valor_cobrado,
    material: proc.custo_material_estimado,
    comissaoPct: proc.comissao_profissional_pct,
    durationMinutes: proc.duration_minutes,
    horasDia: lido.horas,
    margemAlvoPct: proc.margem_minima_desejada,
  });
  relatar(aoVivo, `Ficha ao vivo — ${proc.name}`);
  if (aoVivo.incompleto) {
    throw new Error("Ficha ao vivo incompleta (falta preço ou aluguel).");
  }

  await db.auth.signOut();
  console.log("\nCenário gravado. Conferir em Procedimentos → HIFU facial.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
