import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const PAIRS = [
  "agenda",
  "appointments",
  "clients",
  "clientes",
  "organization_invites",
  "convites",
  "audit_logs",
  "logs",
  "assinaturas",
];

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

for (const t of PAIRS) {
  const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
  console.log(t, error ? error.message : count);
}
