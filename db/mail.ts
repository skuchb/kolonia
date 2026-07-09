import { parseUserState } from "./user-state";

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const FROM_RE = /^[^<]+<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/;

export function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim();
  if (!email || !EMAIL_RE.test(email)) return null;
  return email;
}

export function normalizeResendFrom(value: string | null | undefined): string | null {
  const from = value?.trim();
  if (!from) return null;
  if (EMAIL_RE.test(from) || FROM_RE.test(from)) return from;
  return null;
}

export function parseResendError(raw: string | undefined): string {
  if (!raw?.trim()) return "Nie udało się wysłać maila.";
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    if (parsed.message?.trim()) return parsed.message.trim();
  } catch {
    // Resend sometimes returns plain text.
  }
  return raw.trim().slice(0, 300);
}

export function isEmailOptIn(stateJson: string): boolean {
  return parseUserState(stateJson).emailOptIn !== false;
}

export interface MailRecipientStats {
  registeredUsers: number;
  withEmail: number;
  optedIn: number;
  optedOut: number;
  recipients: number;
}

export interface MailAddressRow {
  displayName: string;
  email: string;
  camp: string | null;
  optedIn: boolean;
}

export interface MailAdminSnapshot extends MailRecipientStats {
  addresses: MailAddressRow[];
}

export function summarizeMailRecipients(
  rows: Array<{ email: string | null; stateJson: string }>,
): MailRecipientStats {
  let withEmail = 0;
  let optedIn = 0;
  let optedOut = 0;

  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (!email) continue;
    withEmail += 1;
    if (isEmailOptIn(row.stateJson)) {
      optedIn += 1;
    } else {
      optedOut += 1;
    }
  }

  return {
    registeredUsers: rows.length,
    withEmail,
    optedIn,
    optedOut,
    recipients: optedIn,
  };
}

export function filterMailRecipients(
  rows: Array<{ email: string | null; stateJson: string }>,
): string[] {
  const emails: string[] = [];
  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (!email) continue;
    if (!isEmailOptIn(row.stateJson)) continue;
    emails.push(email);
  }
  return emails;
}

export function listMailAddresses(
  rows: Array<{ displayName: string; email: string | null; camp: string | null; stateJson: string }>,
): MailAddressRow[] {
  const addresses: MailAddressRow[] = [];
  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (!email) continue;
    addresses.push({
      displayName: row.displayName,
      email,
      camp: row.camp,
      optedIn: isEmailOptIn(row.stateJson),
    });
  }
  addresses.sort((left, right) => left.displayName.localeCompare(right.displayName, "pl"));
  return addresses;
}

export function buildMailAdminSnapshot(
  rows: Array<{ displayName: string; email: string | null; camp: string | null; stateJson: string }>,
): MailAdminSnapshot {
  return {
    ...summarizeMailRecipients(rows),
    addresses: listMailAddresses(rows),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(body: string): string {
  return escapeHtml(body.trim()).replace(/\n/g, "<br />");
}

export function renderKoloniaEmailHtml(options: {
  body: string;
  siteUrl: string;
}): string {
  const siteUrl = options.siteUrl.replace(/\/$/, "");
  const bodyHtml = textToHtml(options.body);

  return `<!DOCTYPE html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>KOLONIA</title>
  </head>
  <body style="margin:0;padding:0;background:#12100e;color:#e8dcc8;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#12100e;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#1a1612;border:1px solid rgba(232,220,200,0.16);">
            <tr>
              <td style="padding:28px 28px 16px;border-bottom:1px solid rgba(232,220,200,0.12);">
                <div style="font-family:Georgia,serif;font-size:28px;letter-spacing:0.22em;color:#ffb070;text-transform:uppercase;">KOLONIA</div>
                <div style="margin-top:8px;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(232,220,200,0.55);">Wiadomość od Kolonii Karnej</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;font-size:17px;line-height:1.65;color:#e8dcc8;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;font-family:ui-monospace,Menlo,monospace;font-size:11px;line-height:1.6;letter-spacing:0.08em;text-transform:uppercase;color:rgba(232,220,200,0.5);">
                <a href="${siteUrl}" style="color:#ffb070;text-decoration:none;">Wejdź do gry</a>
                <br /><br />
                Wyłącz maile w ustawieniach konta na stronie KOLONII.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface ResendConfig {
  apiKey: string;
  from: string;
}

export function readResendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  const from =
    normalizeResendFrom(process.env.RESEND_FROM) ?? normalizeResendFrom("KOLONIA <noreply@kolonia.app>");
  if (!from) return null;
  return { apiKey, from };
}

export async function sendResendEmail(
  config: ResendConfig,
  to: string[],
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  const recipients = to.map((email) => normalizeEmail(email)).filter((email): email is string => Boolean(email));
  if (recipients.length === 0) {
    return { ok: false, error: "Brak prawidłowego adresu odbiorcy." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: recipients,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return { ok: false, error: parseResendError(error) };
  }

  return { ok: true };
}

export async function sendResendBatch(
  config: ResendConfig,
  recipients: string[],
  subject: string,
  html: string,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const batchSize = 100;
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let offset = 0; offset < recipients.length; offset += batchSize) {
    const chunk = recipients
      .slice(offset, offset + batchSize)
      .map((email) => normalizeEmail(email))
      .filter((email): email is string => Boolean(email));
    if (chunk.length === 0) continue;

    const payload = chunk.map((email) => ({
      from: config.from,
      to: [email],
      subject,
      html,
    }));

    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      failed += chunk.length;
      errors.push(parseResendError(await response.text()));
      continue;
    }

    sent += chunk.length;
  }

  return { sent, failed, errors };
}
