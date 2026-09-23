/**
 * Inicia o fluxo OAuth do Google Calendar.
 * GET /api/google-calendar/auth?orgId=xxx
 * Requer Authorization: Bearer. userId da query é ignorado.
 */

import { requireStaffAccess, sendAuthError } from "../../lib/api-auth.js";
import { createSignedOAuthState, getOAuthStateSecret } from "../../lib/oauth-state.js";
import { GOOGLE_CALENDAR_SCOPES } from "../../lib/google-calendar.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido" });
  }

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "dashboard:view" });
  } catch (e) {
    return sendAuthError(res, e);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  let baseUrl = process.env.BASE_URL || "";
  if (!baseUrl && process.env.VERCEL_URL) baseUrl = `https://${process.env.VERCEL_URL}`;
  if (!baseUrl && req.headers.host) {
    const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    baseUrl = `${protocol}://${req.headers.host}`;
  }

  if (!clientId || !baseUrl) {
    return res.status(400).json({
      error: "Configure GOOGLE_CLIENT_ID e BASE_URL no servidor (ou use o app na mesma origem que a API). Em desenvolvimento: BASE_URL=http://localhost:3000",
    });
  }

  if (!getOAuthStateSecret()) {
    return res.status(400).json({
      error: "Configure GOOGLE_CLIENT_SECRET (ou GOOGLE_OAUTH_STATE_SECRET) no servidor.",
    });
  }

  const redirectUri = `${baseUrl}/api/google-calendar/callback`;
  let state;
  try {
    state = createSignedOAuthState({ userId: auth.user.id, orgId: auth.orgId });
  } catch (err) {
    console.error("[google-calendar/auth] state", err?.message || err);
    return res.status(500).json({ error: "Erro interno" });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES,
    state,
    access_type: "offline",
    prompt: "consent",
  });

  const url = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  return res.status(200).json({ url });
}
