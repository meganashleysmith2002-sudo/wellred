// Email helper for WellRed. Sends from support@wellred.club through Google Workspace.
// Needs Vercel env vars: SMTP_PASS (a Google app password for support@wellred.club)
// and NOTIFY_TO (comma-separated host emails, e.g. Meg and Kaitlyn).
// Nothing secret lives in this file; the repo is public.
import nodemailer from 'nodemailer';

const FROM_ADDR = process.env.SMTP_USER || 'support@wellred.club';
const DASH = 'https://wellred.club/needle-velvet-1024';

let transport = null;
function getTransport() {
  if (!process.env.SMTP_PASS) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: FROM_ADDR, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

export async function send({ to, subject, text, html, replyTo }) {
  const t = getTransport();
  if (!t || !to) return { skipped: true };
  try {
    await withTimeout(t.sendMail({
      from: 'WellRed <' + FROM_ADDR + '>',
      to, subject, text, html,
      replyTo: replyTo || FROM_ADDR,
    }), 8000);
    return { ok: true };
  } catch (e) {
    return { error: String(e && e.message || e) };
  }
}

const first = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';

const EVENT = 'Saturday, October 24, 2 to 4 PM\nSouth Florida Sewing Studio, 2629 N Federal Hwy, Fort Lauderdale';

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function heldHtml(s) {
  const p = 'margin:0 0 16px;font-size:16px;line-height:1.5;color:#241412';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F6EFE3">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6EFE3"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FDFAF4;border:1px solid #D39D96;border-radius:16px">
<tr><td style="padding:28px 28px 8px;font-family:Georgia,'Times New Roman',serif">
<p style="margin:0 0 18px;font-size:22px;font-weight:bold;color:#241412">Well<span style="color:#8C1C1C">Red</span></p>
<p style="${p}">Hi ${esc(first(s.name))},</p>
<p style="${p}">Your spot for the WellRed crochet class is held for 48 hours.</p>
<p style="text-align:center;margin:0 0 18px"><img src="https://wellred.club/thanks-cat.gif" width="200" height="356" alt="A very happy cat" style="display:inline-block;border-radius:12px;max-width:100%;height:auto"></p>
<p style="${p};background:#F3DCD7;border-radius:12px;padding:14px 16px"><b>To lock it in, Zelle $50 to Megan Smith at 954-806-3579</b> and put your full name in the memo.</p>
<p style="${p}"><b>Saturday, October 24, 2 to 4 PM</b><br>South Florida Sewing Studio, 2629 N Federal Hwy, Fort Lauderdale</p>
<p style="${p}">Once your Zelle comes through, we'll email you a confirmation. If we don't get it within 48 hours, the spot goes to the next person.</p>
<p style="${p};font-size:14px;color:#6E514A">About refunds: we pay the studio for every seat, so tickets aren't refundable, but you can give your spot to a friend. Just text us their name. If something serious comes up, reach out and we'll work it out.</p>
<p style="${p}">Questions? Text Meg at 954-806-3579.</p>
<p style="margin:0 0 24px;font-size:16px;color:#241412">Kaitlyn &amp; Meg<br><a href="https://wellred.club" style="color:#8C1C1C">wellred.club</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

export function heldEmail(s) {
  return {
    html: heldHtml(s),
    to: s.email,
    subject: 'Your spot is held: WellRed crochet class, Oct 24',
    text:
`Hi ${first(s.name)},

Your spot for the WellRed crochet class is held for 48 hours.

To lock it in, Zelle $50 to Megan Smith at 954-806-3579 and put your full name in the memo.

${EVENT}

Once your Zelle comes through, we'll email you a confirmation. If we don't get it within 48 hours, the spot goes to the next person.

About refunds: we pay the studio for every seat, so tickets aren't refundable, but you can give your spot to a friend. Just text us their name. If something serious comes up, reach out and we'll work it out.

Questions? Text Meg at 954-806-3579.

Kaitlyn & Meg
WellRed
wellred.club`,
  };
}

export function paidEmail(s) {
  return {
    to: s.email,
    subject: "You're in: WellRed crochet class, Oct 24",
    text:
`Hi ${first(s.name)},

Got your Zelle, you're officially in!

${EVENT}

Your yarn, crochet hook, and instructions are covered. Just bring Carmilla (the edition edited by Carmen Maria Machado) and come ready to talk about it.

See you there,
Kaitlyn & Meg
WellRed`,
  };
}

export function hostEmail(s, left, cap) {
  const to = (process.env.NOTIFY_TO || '').split(',').map((x) => x.trim()).filter(Boolean).join(', ');
  return {
    to,
    replyTo: s.email,
    subject: `New spot held: ${s.name} (${cap - left} of ${cap})`,
    text:
`${s.name} just saved a spot for the Oct 24 crochet class.

Phone: ${s.phone}
Email: ${s.email}

${left} of ${cap} spots left. They have 48 hours to Zelle the $50.

When their Zelle comes in, check Paid on the list and they'll get their confirmation email:
${DASH}`,
  };
}
