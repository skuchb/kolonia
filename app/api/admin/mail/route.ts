import { eq } from "drizzle-orm";
import { auditLog, requireAdmin } from "../../../../db/admin";
import { getDb } from "../../../../db";
import {
  buildMailAdminSnapshot,
  filterMailRecipients,
  normalizeEmail,
  readResendConfig,
  renderKoloniaEmailHtml,
  sendResendBatch,
  sendResendEmail,
} from "../../../../db/mail";
import { users } from "../../../../db/schema";
import { siteUrl } from "@/src/core/site";

function resolveSiteUrl(): string {
  return siteUrl();
}

async function resolveAdminEmail(
  db: ReturnType<typeof getDb>,
  user: { id: string; googleSub: string },
): Promise<string | null> {
  const [byId] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const fromId = normalizeEmail(byId?.email);
  if (fromId) return fromId;

  const [bySub] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.googleSub, user.googleSub))
    .limit(1);
  return normalizeEmail(bySub?.email);
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const db = getDb();
    const rows = await db
      .select({
        displayName: users.displayName,
        email: users.email,
        camp: users.camp,
        stateJson: users.stateJson,
      })
      .from(users);
    return Response.json(buildMailAdminSnapshot(rows));
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
    return Response.json(
      {
        error: "resend_not_configured",
        message:
          "Brak lub nieprawidłowy RESEND_API_KEY / RESEND_FROM. Użyj formatu: KOLONIA <noreply@twoja-domena.pl>",
      },
      { status: 503 },
    );
  }

  const html = renderKoloniaEmailHtml({ body: content, siteUrl: resolveSiteUrl() });

  try {
    const db = getDb();

    if (test) {
      const adminEmail = await resolveAdminEmail(db, auth.user);

      if (!adminEmail) {
        return Response.json(
          {
            error: "admin_email_missing",
            message:
              "Brak prawidłowego adresu e-mail admina. Wyloguj się, usuń dostęp aplikacji KOLONIA w koncie Google i zaloguj ponownie.",
          },
          { status: 400 },
        );
      }

      const result = await sendResendEmail(resend, [adminEmail], `[TEST] ${subject}`, html);
      if (!result.ok) {
        return Response.json({ error: "send_failed", detail: result.error, message: result.error }, { status: 502 });
      }

      await auditLog(auth.user.id, "mail_test", "mail", undefined, { subject, to: adminEmail });
      return Response.json({ ok: true, test: true, sent: 1, to: adminEmail });
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
