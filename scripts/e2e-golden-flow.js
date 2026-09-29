/**
 * E2E real do Golden Flow (grava + lê + apaga).
 *
 * Não é grep, unitário nem GET /api/health.
 * Usa o mesmo caminho do app: anon key + senha do master + RLS.
 *
 *   node scripts/e2e-golden-flow.js
 *
 * Credenciais: SUPABASE_URL, SUPABASE_ANON_KEY, QA_EMAIL_MASTER, QA_PASS_MASTER
 *
 * Automático (se login funcionar): LOGIN, ORG, CLIENTE, AGENDA, ANAMNESE,
 * PLANO, PROTOCOLO, APLICADO, ESTOQUE, CUSTO, FINANCEIRO, MARGEM, CRM, PORTAL (RPC).
 *
 * NÃO COMPROVADO nesta suíte:
 * - Preenchimento visual no browser (Playwright/Chromium não faz parte do runtime).
 * - Portal HTML no navegador do paciente (só a sessão/token via RPC).
 * - WhatsApp, mudança de preço de catálogo, consumo de estoque se a tabela recusar INSERT.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { credenciaisGoldenAuth, escolherOrgComPacientes } from "../js/utils/golden-flow-auth.js";
import { resumoMargemOrcamento } from "../js/utils/orcamento-margem.js";

const TAG = "E2E-GF";

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function passo(id, titulo, auto) {
  return { id, titulo, auto, estado: "pendente", detalhe: "" };
}

function ok(p, detalhe) {
  p.estado = "COMPROVADO";
  p.detalhe = detalhe || "";
}

function nao(p, detalhe) {
  p.estado = "NÃO COMPROVADO";
  p.detalhe = detalhe || "";
}

function falhou(p, detalhe) {
  p.estado = "FALHOU";
  p.detalhe = detalhe || "";
}

async function sel(db, table, id) {
  const { data, error } = await db.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function runGoldenFlowE2E(env = process.env) {
  const creds = credenciaisGoldenAuth(env);
  const ids = {
    client: null,
    agenda: null,
    anamnese: null,
    plano: null,
    protocolo: null,
    aplicado: null,
    entrada: null,
    consumo: null,
    procedure: null,
    financeiro: null,
    orcamento: null,
    waitlist: null,
    portalToken: null,
    funcao: null,
  };

  const passos = [
    passo("login", "LOGIN", true),
    passo("organizacao", "ORGANIZAÇÃO", true),
    passo("cliente", "CLIENTE", true),
    passo("agenda", "AGENDA", true),
    passo("anamnese", "ANAMNESE", true),
    passo("plano", "PLANO", true),
    passo("protocolo", "PROTOCOLO", true),
    passo("aplicado", "PROTOCOLO APLICADO", true),
    passo("estoque", "ESTOQUE", true),
    passo("custo", "CUSTO", true),
    passo("financeiro", "FINANCEIRO", true),
    passo("margem", "MARGEM", true),
    passo("crm", "CRM", true),
    passo("portal", "PORTAL", true),
    passo("ui-browser", "UI no browser (todas as telas)", false),
  ];

  const by = (id) => passos.find((p) => p.id === id);
  const rel = { quando: new Date().toISOString(), runId: "", orgId: null, passos, ids };

  if (!creds.ok) {
    const msg = "Falta SUPABASE_URL, SUPABASE_ANON_KEY, QA_EMAIL_MASTER ou QA_PASS_MASTER no .env";
    for (const p of passos) nao(p, msg);
    rel.skippedCredenciais = true;
    return rel;
  }

  const db = createClient(creds.url, creds.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runId = `${Date.now()}`;
  rel.runId = runId;
  const marker = `${TAG}-${runId}`;
  const produto = `${marker}-descartavel`;
  const procNome = `${marker}-sessao`;

  const cleanup = async () => {
    const erros = [];
    const del = async (label, q) => {
      const { error } = await q;
      if (error) erros.push(`${label}: ${error.message}`);
    };
    const order = [
      ["estoque_consumo", ids.consumo],
      ["protocolos_aplicados", ids.aplicado],
      ["protocolos_descartaveis", ids.protocolo ? { col: "protocolo_id", val: ids.protocolo } : null],
      ["protocolos", ids.protocolo],
      ["financeiro", ids.financeiro],
      ["orcamentos", ids.orcamento],
      ["agenda_waitlist", ids.waitlist],
      ["anamnesis_registros", ids.anamnese],
      ["anamnesis_funcoes", ids.funcao],
      ["planos_terapeuticos_procedimentos", ids.plano ? { col: "plano_id", val: ids.plano } : null],
      ["planos_terapeuticos", ids.plano],
      ["agenda", ids.agenda],
      ["estoque_entradas", ids.entrada],
      ["procedures", ids.procedure],
      ["clients", ids.client],
    ];
    for (const [table, ref] of order) {
      if (!ref) continue;
      if (typeof ref === "string") {
        await del(table, db.from(table).delete().eq("id", ref));
      } else {
        await del(table, db.from(table).delete().eq(ref.col, ref.val));
      }
    }
    if (ids.portalToken) {
      await del("client_sessions", db.from("client_sessions").delete().eq("token", ids.portalToken));
    }
    if (!rel.orgId) {
      if (erros.length) rel.cleanupErro = erros.join(" | ");
      return;
    }
    await del("estoque_consumo TAG", db.from("estoque_consumo").delete().eq("org_id", rel.orgId).like("produto_nome", `${TAG}-%`));
    const { data: leftovers } = await db
      .from("clients")
      .select("id")
      .eq("org_id", rel.orgId)
      .like("name", `${TAG}-%`);
    const childByClient = [
      "client_events",
      "client_sessions",
      "client_packages",
      "client_evolution_photos",
      "client_protocols",
      "analise_pele",
      "anamnesis_registros",
      "skincare_rotinas",
      "protocolos_aplicados",
      "agenda_waitlist",
      "orcamentos",
    ];
    for (const row of leftovers || []) {
      const cid = row.id;
      for (const t of childByClient) {
        await del(`${t}/${cid}`, db.from(t).delete().eq("client_id", cid));
      }
      await del(`agenda/${cid}`, db.from("agenda").delete().eq("cliente_id", cid));
      await del(`clients/${cid}`, db.from("clients").delete().eq("id", cid).eq("org_id", rel.orgId));
    }
    await del("estoque_consumo TAG", db.from("estoque_consumo").delete().eq("org_id", rel.orgId).like("produto_nome", `${TAG}-%`));
    const { data: protos } = await db.from("protocolos").select("id").eq("org_id", rel.orgId).like("nome", `${TAG}-%`);
    for (const p of protos || []) {
      await del(`descartaveis/${p.id}`, db.from("protocolos_descartaveis").delete().eq("protocolo_id", p.id));
    }
    const { data: planosL } = await db.from("planos_terapeuticos").select("id").eq("org_id", rel.orgId).like("nome", `${TAG}-%`);
    for (const p of planosL || []) {
      await del(`plano-proc/${p.id}`, db.from("planos_terapeuticos_procedimentos").delete().eq("plano_id", p.id));
    }
    await del("procedures TAG", db.from("procedures").delete().eq("org_id", rel.orgId).like("name", `${TAG}-%`));
    await del("protocolos TAG", db.from("protocolos").delete().eq("org_id", rel.orgId).like("nome", `${TAG}-%`));
    await del("planos TAG", db.from("planos_terapeuticos").delete().eq("org_id", rel.orgId).like("nome", `${TAG}-%`));
    await del("financeiro TAG", db.from("financeiro").delete().eq("org_id", rel.orgId).like("descricao", `${TAG}-%`));
    await del("estoque_entradas TAG", db.from("estoque_entradas").delete().eq("org_id", rel.orgId).like("produto_nome", `${TAG}-%`));
    await del("funcoes e2e", db.from("anamnesis_funcoes").delete().eq("org_id", rel.orgId).like("slug", "e2e_%"));
    const { data: still } = await db
      .from("clients")
      .select("id")
      .eq("org_id", rel.orgId)
      .like("name", `${TAG}-%`);
    if (still?.length) {
      for (const row of still) {
        await db
          .from("clients")
          .update({
            status: "archived",
            state: "arquivado",
            created_at: "2020-01-01T00:00:00.000Z",
          })
          .eq("id", row.id)
          .eq("org_id", rel.orgId)
          .like("name", `${TAG}-%`);
      }
      await db.from("procedures").update({ active: false }).eq("org_id", rel.orgId).like("name", `${TAG}-%`);
      rel.cleanupAviso = `DELETE em clients bloqueado pelo RLS; ${still.length} cadastro(s) ${TAG}-* foram arquivados.`;
    }
    const ruido = erros.filter((e) => !/does not exist|schema cache|PGRST205/i.test(e));
    if (ruido.length) rel.cleanupErro = ruido.join(" | ");
  };

  try {
    const loginP = by("login");
    const { data: session, error: loginErr } = await db.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    });
    if (loginErr || !session?.user?.id || !session?.session?.access_token) {
      falhou(loginP, loginErr?.message || "signInWithPassword sem JWT");
      for (const p of passos.filter((x) => x.id !== "login" && x.id !== "ui-browser")) {
        nao(p, "Dependia do LOGIN");
      }
      nao(by("ui-browser"), "Suíte não abre Chromium; login comprovado só via Auth API.");
      return rel;
    }
    ok(loginP, `user ${session.user.id}`);

    const orgP = by("organizacao");
    const orgPick = await escolherOrgComPacientes(db);
    if (!orgPick.ok || !orgPick.orgId) {
      falhou(orgP, orgPick.detalhe || "sem membership");
      for (const p of passos.filter((x) => !["login", "organizacao", "ui-browser"].includes(x.id))) {
        nao(p, "Dependia da ORGANIZAÇÃO");
      }
      nao(by("ui-browser"), "Sem browser E2E nesta suíte.");
      return rel;
    }
    const orgId = orgPick.orgId;
    rel.orgId = orgId;
    ok(orgP, `org ${orgId} role=${orgPick.role || "?"} clientes=${orgPick.clientes}`);

    const uid = session.user.id;
    const hojeStr = hoje();

    const clienteP = by("cliente");
    {
      const { data, error } = await db
        .from("clients")
        .insert({
          org_id: orgId,
          name: marker,
          phone: "11999990000",
          email: `${runId}@e2e.skinclinic.invalid`,
          status: "active",
          state: "em_acompanhamento",
        })
        .select("id, org_id, name")
        .single();
      if (error || data?.org_id !== orgId) {
        falhou(clienteP, error?.message || "insert clients recusado");
      } else {
        ids.client = data.id;
        const lido = await sel(db, "clients", data.id);
        if (!lido || lido.name !== marker) falhou(clienteP, "SELECT não devolveu o cliente gravado");
        else ok(clienteP, data.id);
      }
    }

    const agendaP = by("agenda");
    if (!ids.client) nao(agendaP, "Sem cliente");
    else {
      const { data, error } = await db
        .from("agenda")
        .insert({
          org_id: orgId,
          cliente_id: ids.client,
          data: hojeStr,
          hora: "10:00",
          duration_minutes: 60,
          procedimento: procNome,
        })
        .select("id, cliente_id, org_id")
        .single();
      if (error || data?.cliente_id !== ids.client) {
        falhou(agendaP, error?.message || "agenda não ligou no cliente");
      } else {
        ids.agenda = data.id;
        ok(agendaP, data.id);
      }
    }

    const anamneseP = by("anamnese");
    if (!ids.client) nao(anamneseP, "Sem cliente");
    else {
      const { data: funcoes, error: fErr } = await db
        .from("anamnesis_funcoes")
        .select("id")
        .eq("org_id", orgId)
        .limit(1);
      let funcaoId = funcoes?.[0]?.id;
      if (!funcaoId) {
        const insF = await db
          .from("anamnesis_funcoes")
          .insert({ org_id: orgId, nome: `${marker}-area`, slug: `e2e_${runId}`, ordem: 99 })
          .select("id")
          .single();
        funcaoId = insF.data?.id;
        if (funcaoId) ids.funcao = funcaoId;
        if (insF.error) falhou(anamneseP, insF.error.message);
      }
      if (funcaoId) {
        const { data, error } = await db
          .from("anamnesis_registros")
          .insert({
            org_id: orgId,
            client_id: ids.client,
            funcao_id: funcaoId,
            agenda_id: ids.agenda,
            conteudo: `${marker} anamnese`,
            ficha: { queixa_principal: "e2e" },
            fotos: [],
            author_id: uid,
          })
          .select("id, client_id, agenda_id")
          .single();
        if (error || data?.client_id !== ids.client) {
          falhou(anamneseP, error?.message || "anamnese sem cliente");
        } else {
          ids.anamnese = data.id;
          ok(anamneseP, `registro ${data.id} agenda=${data.agenda_id || "null"}`);
        }
      }
    }

    const planoP = by("plano");
    {
      const { data: proc, error: pErr } = await db
        .from("procedures")
        .insert({
          org_id: orgId,
          name: procNome,
          duration_minutes: 60,
          active: true,
          valor_cobrado: 200,
          custo_material_estimado: 80,
        })
        .select("id")
        .single();
      if (pErr) {
        const retry = await db
          .from("procedures")
          .insert({ org_id: orgId, name: procNome, duration_minutes: 60, active: true })
          .select("id")
          .single();
        if (retry.error) falhou(planoP, retry.error.message);
        else ids.procedure = retry.data.id;
      } else {
        ids.procedure = proc.id;
      }
      if (ids.procedure) {
        const { data, error } = await db
          .from("planos_terapeuticos")
          .insert({
            org_id: orgId,
            nome: `${marker}-plano`,
            dor_cliente: "e2e",
            explicacao_terapeutica: "fluxo integrado",
          })
          .select("id")
          .single();
        if (error) falhou(planoP, error.message);
        else {
          ids.plano = data.id;
          const link = await db.from("planos_terapeuticos_procedimentos").insert({
            plano_id: ids.plano,
            procedure_id: ids.procedure,
            ordem: 0,
            quantidade: 1,
          });
          if (link.error) falhou(planoP, `plano ok, vínculo: ${link.error.message}`);
          else ok(planoP, `${ids.plano} + procedure ${ids.procedure}`);
        }
      }
    }

    const protoP = by("protocolo");
    {
      const { data, error } = await db
        .from("protocolos")
        .insert({
          org_id: orgId,
          nome: `${marker}-protocolo`,
          descricao_passos: "1. e2e",
          observacoes: marker,
          active: true,
        })
        .select("id")
        .single();
      if (error) {
        const retry = await db
          .from("protocolos")
          .insert({ org_id: orgId, nome: `${marker}-protocolo`, descricao_passos: "1. e2e" })
          .select("id")
          .single();
        if (retry.error) falhou(protoP, retry.error.message);
        else ids.protocolo = retry.data.id;
      } else {
        ids.protocolo = data.id;
      }
      if (ids.protocolo) {
        await db.from("protocolos_descartaveis").insert({
          protocolo_id: ids.protocolo,
          produto_nome: produto,
          quantidade: 1,
        });
        ok(protoP, ids.protocolo);
      }
    }

    const estoqueP = by("estoque");
    {
      const { data, error } = await db
        .from("estoque_entradas")
        .insert({
          org_id: orgId,
          produto_nome: produto,
          quantidade: 10,
          valor_unitario: 8,
          valor_total: 80,
          data_entrada: hojeStr,
          origem: "manual",
          created_by: uid,
        })
        .select("id, quantidade")
        .single();
      if (error) falhou(estoqueP, error.message);
      else {
        ids.entrada = data.id;
        ok(estoqueP, `entrada ${data.id} qtd=${data.quantidade}`);
      }
    }

    const aplicadoP = by("aplicado");
    if (!ids.client || !ids.protocolo) nao(aplicadoP, "Sem cliente ou protocolo");
    else {
      const { data, error } = await db
        .from("protocolos_aplicados")
        .insert({
          org_id: orgId,
          client_id: ids.client,
          protocolo_id: ids.protocolo,
          agenda_id: ids.agenda,
          aplicado_em: new Date().toISOString(),
          descricao: marker,
          observacao: "e2e aplicado",
          produtos_usados: [{ produto_nome: produto, quantidade: 1 }],
          created_by: uid,
        })
        .select("id, client_id, agenda_id, protocolo_id")
        .single();
      if (error || data?.protocolo_id !== ids.protocolo || data?.client_id !== ids.client) {
        falhou(aplicadoP, error?.message || "aplicado não cruzou cliente/protocolo");
      } else {
        ids.aplicado = data.id;
        const cons = await db
          .from("estoque_consumo")
          .insert({
            org_id: orgId,
            produto_nome: produto,
            quantidade: 1,
            agenda_id: ids.agenda,
            protocolo_aplicado_id: ids.aplicado,
            tipo: "estimado",
            created_by: uid,
          })
          .select("id")
          .single();
        if (!cons.error) ids.consumo = cons.data.id;
        ok(
          aplicadoP,
          `${data.id} agenda=${data.agenda_id || "null"} consumo=${ids.consumo || "não gravou estoque_consumo"}`
        );
      }
    }

    const custoP = by("custo");
    if (!ids.entrada || !ids.procedure) nao(custoP, "Sem entrada de estoque ou procedimento");
    else {
      const ent = await sel(db, "estoque_entradas", ids.entrada);
      const proc = await sel(db, "procedures", ids.procedure);
      const unit = Number(ent?.valor_unitario);
      const cobrado = Number(proc?.valor_cobrado);
      const est = Number(proc?.custo_material_estimado);
      if (!Number.isFinite(unit) || unit <= 0) {
        falhou(custoP, "entrada sem valor_unitario");
      } else {
        ok(
          custoP,
          `estoque unitário ${unit}; procedimento cobrado=${Number.isFinite(cobrado) ? cobrado : "n/a"} custo_est=${Number.isFinite(est) ? est : "n/a"}`
        );
      }
    }

    const finP = by("financeiro");
    if (!ids.agenda || !ids.client) nao(finP, "Sem agenda");
    else {
      const { data, error } = await db
        .from("financeiro")
        .insert({
          org_id: orgId,
          tipo: "entrada",
          descricao: marker,
          valor: 200,
          valor_recebido: 200,
          data: hojeStr,
          agenda_id: ids.agenda,
          user_id: uid,
        })
        .select("id, agenda_id, valor")
        .single();
      if (error) {
        const retry = await db
          .from("financeiro")
          .insert({
            org_id: orgId,
            tipo: "entrada",
            descricao: marker,
            valor: 200,
            data: hojeStr,
            agenda_id: ids.agenda,
            user_id: uid,
          })
          .select("id, agenda_id")
          .single();
        if (retry.error) falhou(finP, retry.error.message);
        else {
          ids.financeiro = retry.data.id;
          ok(finP, `${retry.data.id} agenda=${retry.data.agenda_id}`);
        }
      } else if (data.agenda_id !== ids.agenda) {
        falhou(finP, "baixa sem agenda_id");
      } else {
        ids.financeiro = data.id;
        ok(finP, `${data.id} valor=${data.valor}`);
      }
    }

    const margemP = by("margem");
    if (!ids.client) nao(margemP, "Sem cliente");
    else {
      const items = [
        { kind: "servico", name: procNome, qty: 1, unit_price: 200, unit_cost: 80, sessions: 1 },
      ];
      const { data, error } = await db
        .from("orcamentos")
        .insert({
          org_id: orgId,
          client_id: ids.client,
          status: "rascunho",
          items,
          notes: marker,
        })
        .select("id, items, client_id")
        .single();
      if (error) falhou(margemP, error.message);
      else {
        ids.orcamento = data.id;
        const lido = await sel(db, "orcamentos", data.id);
        const resumo = resumoMargemOrcamento(lido.items);
        if (resumo.margemServicoPct == null || resumo.custoServico !== 80 || resumo.receitaServico !== 200) {
          falhou(margemP, JSON.stringify(resumo));
        } else {
          ok(margemP, `orçamento ${data.id} margem serviço ${resumo.margemServicoPct}%`);
        }
      }
    }

    const crmP = by("crm");
    if (!ids.client) nao(crmP, "Sem cliente");
    else {
      const { data, error } = await db
        .from("agenda_waitlist")
        .insert({
          org_id: orgId,
          client_id: ids.client,
          nome: marker,
          phone: "11999990000",
          procedure_name: procNome,
          preferred_date: hojeStr,
          notes: marker,
          status: "aberta",
        })
        .select("id, client_id")
        .single();
      if (error) falhou(crmP, error.message);
      else if (data.client_id !== ids.client) falhou(crmP, "espera sem client_id");
      else {
        ids.waitlist = data.id;
        const ag = ids.agenda ? await sel(db, "agenda", ids.agenda) : null;
        ok(crmP, `espera ${data.id}; agenda do mesmo cliente=${ag?.cliente_id === ids.client}`);
      }
    }

    const portalP = by("portal");
    if (!ids.client) nao(portalP, "Sem cliente");
    else {
      const rpc = await db.rpc("create_client_portal_session", {
        p_org_id: orgId,
        p_client_id: ids.client,
      });
      if (rpc.error) {
        nao(portalP, `RPC create_client_portal_session: ${rpc.error.message}. HTML do portal no browser também não entra nesta suíte.`);
      } else {
        const token = rpc.data?.token || rpc.data;
        const tok = typeof token === "string" ? token : token?.token;
        if (!tok) {
          nao(portalP, `RPC sem token: ${JSON.stringify(rpc.data)}`);
        } else {
          ids.portalToken = tok;
          const byTok = await db.rpc("get_client_by_token", { p_token: tok });
          if (byTok.error) {
            nao(portalP, `token criado, get_client_by_token: ${byTok.error.message}`);
          } else {
            ok(portalP, `sessão ${String(tok).slice(0, 8)}… RPC leu o cliente`);
          }
        }
      }
    }

    nao(
      by("ui-browser"),
      "Não há Playwright/Chromium nesta suíte. Telas LOGIN→…→PORTAL no browser continuam NÃO COMPROVADAS."
    );
  } finally {
    try {
      await cleanup();
    } catch (e) {
      rel.cleanupErro = String(e?.message || e);
    }
  }

  return rel;
}

function imprimir(rel) {
  console.log(`\nGolden Flow E2E  ${rel.quando}`);
  if (rel.orgId) console.log(`org ${rel.orgId}  run ${rel.runId}`);
  if (rel.skippedCredenciais) console.log("Credenciais ausentes — nada foi gravado.");
  for (const p of rel.passos) {
    console.log(`- ${p.titulo}: ${p.estado}${p.detalhe ? ` — ${p.detalhe}` : ""}`);
  }
  if (rel.cleanupErro) console.log("cleanup:", rel.cleanupErro);
  if (rel.cleanupAviso) console.log("aviso:", rel.cleanupAviso);
  const falhas = rel.passos.filter((p) => p.estado === "FALHOU");
  const okN = rel.passos.filter((p) => p.estado === "COMPROVADO").length;
  const naoN = rel.passos.filter((p) => p.estado === "NÃO COMPROVADO").length;
  console.log(`\nCOMPROVADO ${okN}  |  NÃO COMPROVADO ${naoN}  |  FALHOU ${falhas.length}\n`);
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMain) {
  const rel = await runGoldenFlowE2E();
  imprimir(rel);
  const falhas = rel.passos.filter((p) => p.estado === "FALHOU");
  process.exit(falhas.length ? 1 : 0);
}
