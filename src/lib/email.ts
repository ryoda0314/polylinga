import "server-only";

// Emails the app sends itself, through Resend: the shared Supabase project's templates belong to the old app. Sent from
// the old app's verified domain until ことのあめ has one of its own.
const FROM = process.env.EMAIL_FROM || "ことのあめ <no-reply@polylinga.app>";

export type LinkMail = {
  subject: string;
  title: string;
  body: string;
  button: string;
  url: string;
  linkNote: string;
  ignore: string;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** One short, flat message: the name, what to do, one button, the link written out, and why they got it. */
function html(m: LinkMail): string {
  const sans = `"Hiragino Sans","Yu Gothic",Meiryo,sans-serif`;
  const mincho = `"Hiragino Mincho ProN","Yu Mincho",serif`;
  return `<!doctype html><html lang="ja"><body style="margin:0;padding:0;background:#fcfbf8">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;font-family:${sans};color:#172033;line-height:1.8">
<p style="margin:0 0 28px;font-family:${mincho};font-size:20px;font-weight:700;letter-spacing:.06em">ことのあめ</p>
<h1 style="margin:0 0 12px;font-size:20px;font-weight:600">${esc(m.title)}</h1>
<p style="margin:0 0 24px;font-size:15px;color:#3b4558">${esc(m.body)}</p>
<p style="margin:0 0 28px"><a href="${esc(m.url)}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:#0a64f0;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none">${esc(m.button)}</a></p>
<p style="margin:0 0 6px;font-size:13px;color:#5c6578">${esc(m.linkNote)}</p>
<p style="margin:0 0 28px;font-size:13px;word-break:break-all"><a href="${esc(m.url)}" style="color:#0a64f0">${esc(m.url)}</a></p>
<p style="margin:0;padding-top:16px;border-top:1px solid #e4e7ec;font-size:12px;color:#5c6578">${esc(m.ignore)}</p>
</div></body></html>`;
}

function text(m: LinkMail): string {
  return `ことのあめ\n\n${m.title}\n\n${m.body}\n\n${m.url}\n\n${m.ignore}\n`;
}

/** Send a mail carrying one link. False when it could not be sent (the caller gives the use back). */
export async function sendLinkMail(to: string, m: LinkMail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[mail] RESEND_API_KEY is not set");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject: m.subject, html: html(m), text: text(m) }),
  }).catch(() => null);
  if (!res?.ok) {
    console.error("[mail]", res?.status ?? "network", res ? (await res.text()).slice(0, 200) : "");
    return false;
  }
  return true;
}
