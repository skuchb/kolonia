import { eq } from "drizzle-orm";
import { auditLog, requireAdmin } from "../../../../db/admin";
import { getDb } from "../../../../db";
import {
  filterMailRecipients,
  readResendConfig,
  renderKoloniaEmailHtml,
  sendResendBatch,
  sendResendEmail,
  summarizeMailRecipients,
} from "../../../../db/mail";
import { users } from "../../../../db/schema";
import { siteUrl } from "@/src/core/site";

function resolveSiteUrl(): string {
  return siteUrl();
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const db = getDb();
    const rows = await db.select({ email: users.email, stateJson: users.stateJson }).from(users);
    return Response.json(summarizeMailRecipients(rows));
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  let body: { subject?: string; content?: string; test?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const subject = body.subject?.trim() ?? "";
  const content = body.content?.trim() ?? "";
  const test = body.test === true;

  if (!subject || !content) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }

  const resend = readResendConfig();
  if (!resend) {
    return Response.json({ error: "resend_not_configured" }, { status: 503 });
  }

  const html = renderKoloniaEmailHtml({ body: content, siteUrl: resolveSiteUrl() });

  try {
    const db = getDb();

    if (test) {
      const [adminRow] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, auth.user.id))
        .limit(1);

      if (!adminRow?.email) {
        return Response.json(
          {
            error: "admin_email_missing",
            message: "Brak adresu e-mail admina. Wyloguj się i zaloguj ponownie przez Google.",
          },
          { status: 400 },
        );
      }

      const result = await sendResendEmail(resend, [adminRow.email], `[TEST] ${subject}`, html);
      if (!result.ok) {
        return Response.json({ error: "send_failed", detail: result.error }, { status: 502 });
      }

      await auditLog(auth.user.id, "mail_test", "mail", undefined, { subject, to: adminRow.email });
      return Response.json({ ok: true, test: true, sent: 1, to: adminRow.email });
    }

    const rows = await db.select({ email: users.email, stateJson: users.stateJson }).from(users);
    const recipients = filterMailRecipients(rows);

    if (recipients.length === 0) {
      return Response.json({ error: "no_recipients" }, { status: 400 });
    }

    const result = await sendResendBatch(resend, recipients, subject, html);
    await auditLog(auth.user.id, "mail_send", "mail", undefined, {
      subject,
      sent: result.sent,
      failed: result.failed,
      recipients: recipients.length,
    });

    return Response.json({
      ok: result.failed === 0,
      sent: result.sent,
      failed: result.failed,
      recipients: recipients.length,
      errors: result.errors,
    });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
