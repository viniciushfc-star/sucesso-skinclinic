import { apiFetch } from "../core/api-fetch.js";
import { supabase } from "../core/supabase.js";
import { withOrg } from "../core/org.js";
import { getRadarRetorno } from "./crm.service.js";
import { listWaitlist } from "./waitlist.service.js";
import { getTodayLocal } from "./metrics.service.js";
import { addCalendarDays } from "../utils/plano-agenda.js";
import {
  buildMarketingCampaigns,
  countSinais,
} from "../utils/marketing-intelligence.js";

/**
 * Copilot de Marketing — sugere conteúdo, foco, métricas e timing.
 */
export async function gerarMarketing(payload) {
  return apiFetch("/api/marketing", { method: "POST", json: payload }).then((r) => r.json());
}

async function countAgendaProximos7d() {
  const start = getTodayLocal();
  const end = addCalendarDays(start, 7);
  const { data, error } = await withOrg(
    supabase
      .from("agenda")
      .select("id, cancelled_at, data")
      .gte("data", start)
      .lte("data", end)
      .limit(4000)
  );
  if (error) return null;
  return (data || []).filter((r) => !r.cancelled_at).length;
}

export async function loadMarketingCampaigns() {
  const [radar, esperaRows, horarios] = await Promise.all([
    getRadarRetorno().catch(() => []),
    listWaitlist("aberta").catch(() => []),
    countAgendaProximos7d().catch(() => null),
  ]);
  return buildMarketingCampaigns({
    counts: countSinais(radar),
    espera: (esperaRows || []).length,
    horariosProximos7d: horarios,
  });
}
