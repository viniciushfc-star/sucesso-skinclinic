import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const { data: a } = await supabase.from("clients").select("id");
const { data: b } = await supabase.from("clientes").select("id");
const A = new Set((a || []).map((r) => r.id));
const B = new Set((b || []).map((r) => r.id));
let both = 0;
for (const id of A) if (B.has(id)) both += 1;
console.log("clients", A.size, "clientes", B.size, "ids_em_ambas", both, "so_clients", A.size - both, "so_clientes", B.size - both);
