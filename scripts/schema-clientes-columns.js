import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

for (const t of ["clients", "clientes"]) {
  const { data, error } = await supabase.from(t).select("*").limit(1);
  console.log(t, error ? error.message : Object.keys(data?.[0] || { _empty: true }).join(","));
}

const { data: ag } = await supabase.from("agenda").select("id, cliente_id, org_id").limit(20);
const clientIds = [...new Set((ag || []).map((r) => r.cliente_id).filter(Boolean))];
console.log("agenda_rows", (ag || []).length, "cliente_ids", clientIds.length);

if (clientIds.length) {
  const { data: inClients } = await supabase.from("clients").select("id").in("id", clientIds);
  const { data: inClientes } = await supabase.from("clientes").select("id").in("id", clientIds);
  console.log("agenda_fk_in_clients", (inClients || []).length, "agenda_fk_in_clientes", (inClientes || []).length);
}
