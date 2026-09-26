/**
 * Sinal de falha de senha: sem e-mail, sem senha, sem JWT.
 * POST /api/obs-login-fail
 */
import { persistApiEvent, recordLoginFailPing } from "../lib/observability.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });
  recordLoginFailPing();
  persistApiEvent({
    kind: "login_fail",
    status: 401,
    method: "POST",
    route: "/api/obs-login-fail",
    orgId: null,
    message: "credencial recusada",
    durationMs: null,
  });
  return res.status(204).end();
}
