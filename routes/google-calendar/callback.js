/**
 * Callback OAuth Google Calendar: troca code por tokens e grava na tabela.
 * GET /api/google-calendar/callback?code=xxx&state=xxx
 * O state deve ser HMAC assinado em /auth (userId/orgId não são autoridade se forjados).
 */

import { getAdminClient } from "../../lib/api-auth.js";
import { verifySignedOAuthState } from "../../lib/oauth-state.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const code = req.query.code;
  const stateRaw = req.query.state;
  let baseUrl = process.env.BASE_URL || "";
  if (!baseUrl && process.env.VERCEL_URL) baseUrl = `https://${process.env.VERCEL_URL}`;
  if (!baseUrl && req.headers.host) {
    const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    baseUrl = `${protocol}://${req.headers.host}`;
  }
  const dashboardUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/dashboard.html#team` : "/dashboard.html#team";

  if (!code || !stateRaw) {
    return res.redirect(302, `${dashboardUrl}?google_calendar=error&message=code_or_state_missing`);
  }

  const claims = verifySignedOAuthState(String(stateRaw));
  if (!claims) {
    return res.redirect(302, `${dashboardUrl}?google_calendar=error&message=invalid_state`);
  }
  const { userId, orgId } = claims;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${baseUrl}/api/google-calendar/callback`;

  if (!clientId || !clientSecret) {
    return res.redirect(302, `${dashboardUrl}?google_calendar=error&message=server_config`);
  }

  try {
    const admin = getAdminClient();
    const { data: membership } = await admin
      .from("organization_users")
      .select("org_id")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!membership) {
      return res.redirect(302, `${dashboardUrl}?google_calendar=error&message=invalid_state`);
    }
  } catch (err) {
    console.error("[google-calendar callback] membership", err?.message || err);
    return res.redirect(302, `${dashboardUrl}?google_calendar=error&message=server_config`);
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    console.error("[google-calendar callback] token exchange failed", tokenRes.status);
    return res.redirect(302, `${dashboardUrl}?google_calendar=error&message=token_failed`);
  }

  const tokens = await tokenRes.json();
  const refreshToken = tokens.refresh_token || tokens.access_token;
  if (!refreshToken) {
    return res.redirect(302, `${dashboardUrl}?google_calendar=error&message=no_refresh_token`);
  }

  const supabase = getAdminClient();
  const { error } = await supabase.from("google_calendar_connections").upsert(
    {
      org_id: orgId,
      user_id: userId,
      refresh_token: refreshToken,
      calendar_id: "primary",
      last_sync_at: null,
    },
    { onConflict: "org_id,user_id" }
  );

  if (error) {
    console.error("[google-calendar callback] upsert failed");
    return res.redirect(302, `${dashboardUrl}?google_calendar=error&message=db_failed`);
  }

  return res.redirect(302, `${dashboardUrl}?google_calendar=connected`);
}
