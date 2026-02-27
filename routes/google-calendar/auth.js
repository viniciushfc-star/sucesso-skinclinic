/**
 * Inicia o fluxo OAuth do Google Calendar.
 * GET /api/google-calendar/auth?userId=xxx&orgId=xxx
 * Redireciona para Google; após autorização, o usuário volta em /api/google-calendar/callback.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const userId = req.query.userId || "";
  const orgId = req.query.orgId || "";
  if (!userId || !orgId) {
    return res.status(400).json({
      error: "Envie userId e orgId na query.",
    });
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

  const redirectUri = `${baseUrl}/api/google-calendar/callback`;
  const state = Buffer.from(JSON.stringify({ userId, orgId }), "utf8").toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    state,
    access_type: "offline",
    prompt: "consent",
  });

  res.redirect(302, `${GOOGLE_AUTH_URL}?${params.toString()}`);
}

