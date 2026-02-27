/**
 * Envia e-mail de confirmação/convite para novo funcionário.
 * POST /api/send-invite-email
 * Body: { email, role, orgName?, appUrl? }
 * Requer RESEND_API_KEY no .env (e-mail de envio pode ser configurado ou usar onboarding@resend.dev em dev).
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_EMAIL = process.env.INVITE_EMAIL_FROM || "SkinClinic <onboarding@resend.dev>";

function getAppUrl() {
  const base = process.env.BASE_URL || process.env.VERCEL_URL;
  if (base) return base.replace(/\/$/, "");
  return "https://seu-dominio.com";
}

export default async function sendInviteEmail(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { email, role, orgName } = req.body || {};
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "E-mail inválido" });
  }

  const appUrl = getAppUrl();
  const roleLabel = role === "gestor" ? "Gestor" : role === "master" ? "Administrador" : role === "staff" ? "Funcionário" : role === "viewer" ? "Visualização" : role || "Membro";
  const clinicName = orgName && String(orgName).trim() ? String(orgName).trim() : "a clínica";

  const subject = `Convite para entrar em ${clinicName}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #333;">
  <p>Olá,</p>
  <p>Você foi convidado(a) para fazer parte da equipe de <strong>${escapeHtml(clinicName)}</strong> com a função de <strong>${escapeHtml(roleLabel)}</strong>.</p>
  <p>Para aceitar o convite:</p>
  <ol>
    <li>Acesse o sistema: <a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a></li>
    <li>Faça login com este e-mail (${escapeHtml(email)}). Se ainda não tiver conta, crie uma com este mesmo e-mail.</li>
    <li>Após o login, você verá o convite e poderá clicar em &quot;Entrar na clínica&quot;.</li>
  </ol>
  <p>Se você não esperava este convite, pode ignorar este e-mail.</p>
  <p>— Equipe SkinClinic</p>
</body>
</html>`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.warn("[send-invite-email] RESEND_API_KEY não configurada. Configure em .env para enviar e-mails. Convite foi registrado no sistema.");
    return res.status(200).json({ ok: true, sent: false, message: "Convite registrado; e-mail não enviado (configure RESEND_API_KEY)." });
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email.trim()],
        subject,
        html,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[send-invite-email] Resend error", response.status, data);
      return res.status(500).json({
        error: "Falha ao enviar e-mail",
        sent: false,
        detail: data.message || data,
      });
    }
    return res.status(200).json({ ok: true, sent: true, id: data.id });
  } catch (err) {
    console.error("[send-invite-email]", err);
    return res.status(500).json({ error: err?.message || "Erro ao enviar e-mail", sent: false });
  }
}

function escapeHtml(s) {
  if (s == null) return "";
  const t = String(s);
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
