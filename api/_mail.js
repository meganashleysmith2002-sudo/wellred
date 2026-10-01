// Email helper for WellRed. Sends from support@wellred.club through Google Workspace.
// Needs Vercel env vars: SMTP_PASS (a Google app password for support@wellred.club)
// and NOTIFY_TO (comma-separated host emails, e.g. Meg and Kaitlyn).
// Nothing secret lives in this file; the repo is public.
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import fs from 'fs';

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

// Real sends stay off until the Vercel env var EMAILS_LIVE is set to "yes".
// Tests (to Meg and Kaitlyn only) work as soon as SMTP_PASS is set.
export async function send({ to, subject, text, html, replyTo, attachments, list, headers }, opts) {
  const t = getTransport();
  if (!t || !to) return { skipped: true };
  if (process.env.EMAILS_LIVE !== 'yes' && !(opts && opts.test)) return { skipped: true, off: true };
  try {
    await withTimeout(t.sendMail({
      from: 'WellRed <' + FROM_ADDR + '>',
      to, subject, text, html, attachments, list, headers,
      replyTo: replyTo || FROM_ADDR,
    }), 8000);
    return { ok: true };
  } catch (e) {
    return { error: String(e && e.message || e) };
  }
}

const first = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';

const MAPS = 'https://www.google.com/maps/search/?api=1&query=South+Florida+Sewing+Studio+2629+N+Federal+Hwy+Fort+Lauderdale+FL';
const STUDIO = 'https://www.southfloridasewingstudio.com/';
const EVENT = 'Saturday, October 24, 2 to 4 PM\nSouth Florida Sewing Studio, 2629 N Federal Hwy, Fort Lauderdale\nMap: ' + MAPS + '\nThe studio: ' + STUDIO;
const VENUE_HTML = (p) => `<p style="${p}"><b>Saturday, October 24, 2 to 4 PM</b><br><a href="${STUDIO}" style="color:#8C1C1C">South Florida Sewing Studio</a>, 2629 N Federal Hwy, Fort Lauderdale<br><a href="${MAPS}" style="color:#8C1C1C">Open in Google Maps</a></p>`;

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
<p style="text-align:center;margin:0 0 18px"><img src="cid:wellred-cat" width="200" height="356" alt="A very happy cat" style="display:inline-block;border-radius:12px;max-width:100%;height:auto"></p>
<p style="${p};background:#F3DCD7;border-radius:12px;padding:14px 16px"><b>To lock it in, Zelle $50 to Megan Smith at 954-806-3579</b> and put your full name in the memo.</p>
${VENUE_HTML(p)}
<p style="${p}">Once your Zelle comes through, we'll email you a confirmation. If we don't get it within 48 hours, the spot goes to the next person.</p>
<p style="${p};font-size:14px;color:#6E514A">About refunds: we pay the studio for every seat, so tickets aren't refundable, but you can give your spot to a friend. Just text us their name. If something serious comes up, reach out and we'll work it out.</p>
<p style="${p}">Questions? Text Meg at 954-806-3579.</p>
<p style="margin:0 0 24px;font-size:16px;color:#241412">Kaitlyn &amp; Meg<br><a href="https://wellred.club" style="color:#8C1C1C">wellred.club</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

// Gifs ride inside the email (inline attachments) so they show even when a
// mail app blocks images that load from a website.

// The gif files ship with this code (api/_assets), so nothing is downloaded at send time.
function asset(fileUrl, fallbackUrl) {
  try { return { content: fs.readFileSync(fileUrl) }; }
  catch (e) { return { path: fallbackUrl }; }
}
const CAT = [{ filename: 'wellred.gif', ...asset(new URL('./_assets/thanks-cat-email.gif', import.meta.url), 'https://www.wellred.club/thanks-cat-email.gif'), cid: 'wellred-cat', contentType: 'image/gif', contentDisposition: 'inline' }];
const PUMPKIN = [{ filename: 'happy-october.gif', ...asset(new URL('./_assets/october-pumpkin-email.gif', import.meta.url), 'https://www.wellred.club/october-pumpkin-email.gif'), cid: 'wellred-pumpkin', contentType: 'image/gif', contentDisposition: 'inline' }];

export function heldEmail(s) {
  return {
    html: heldHtml(s),
    attachments: CAT,
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

// ---------- October early-access email to past form sign-ups ----------
// Unsubscribe links carry an opaque token, never the email address itself.
export function unsubToken(email) {
  return crypto.createHmac('sha256', 'wellred-unsub:' + (process.env.HOST_KEY || '')).update(String(email).toLowerCase()).digest('hex').slice(0, 24);
}
export const unsubUrl = (token) => 'https://wellred.club/api/unsubscribe?t=' + token;
const RESERVE = 'https://wellred.club/meetups#save';

function earlyHtml(name, unsub) {
  const p = 'margin:0 0 16px;font-size:16px;line-height:1.5;color:#241412';
  const hi = name ? `Hi ${esc(first(name))},` : 'Hi there,';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F6EFE3">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6EFE3"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FDFAF4;border:1px solid #D39D96;border-radius:16px">
<tr><td style="padding:28px 28px 8px;font-family:Georgia,'Times New Roman',serif">
<p style="margin:0 0 18px;font-size:22px;font-weight:bold;color:#241412">Well<span style="color:#8C1C1C">Red</span></p>
<p style="${p}">${hi}</p>
<p style="${p}"><b>Happy October!!</b> Since you gave us your email on one of our forms, you get exclusive first access to our October meetup before we post it anywhere else.</p>
<p style="text-align:center;margin:0 0 18px"><img src="cid:wellred-pumpkin" width="300" height="249" alt="Happy October" style="display:inline-block;border-radius:12px;max-width:100%;height:auto"></p>
<p style="${p}">We're doing a crochet class at South Florida Sewing Studio. An instructor will teach everyone to crochet their own bookmark, then we'll talk about Carmilla (the edition edited by Carmen Maria Machado).</p>
${VENUE_HTML(p)}
<p style="${p}">Tickets are $50 and there are only 23 spots. That covers a full 1 to 1.5 hour class with an instructor, your yarn and crochet hook, and printed instructions to take home if you don't finish in class.</p>
<p style="margin:0 0 8px;font-size:16px;font-weight:bold;color:#241412">How to save your spot</p>
<ol style="margin:0 0 20px;padding-left:22px;font-size:16px;line-height:1.5;color:#241412">
<li style="margin-bottom:6px">Click the button below and fill out the short form.</li>
<li style="margin-bottom:6px">You'll get an email that your spot is held for 48 hours.</li>
<li style="margin-bottom:6px">Zelle $50 to Megan Smith at 954-806-3579 with your full name in the memo.</li>
<li>Once it comes through, we'll email you that you're officially in.</li>
</ol>
<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:4px auto 24px"><tr><td align="center" bgcolor="#8C1C1C" style="background:#8C1C1C;border-radius:999px;mso-padding-alt:14px 28px"><a href="${RESERVE}" target="_blank" style="display:block;padding:14px 28px;font-family:Georgia,serif;font-size:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;border-radius:999px">Reserve your spot</a></td></tr></table>
<p style="${p};text-align:center;font-size:14px">Or go to <a href="${RESERVE}" style="color:#8C1C1C">wellred.club/meetups</a></p>
<p style="${p}">Hope to see you there,<br>Kaitlyn &amp; Meg</p>
<p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#6E514A">You're getting this because you shared your email on a WellRed form. <a href="${unsub}" style="color:#6E514A;text-decoration:underline">Unsubscribe</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

export function earlyEmail(to, name, token) {
  const unsub = unsubUrl(token || unsubToken(to));
  return {
    to,
    list: { unsubscribe: { url: unsub, comment: 'Unsubscribe' } },
    headers: { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    subject: 'Happy October! You get first access to our next meetup',
    html: earlyHtml(name, unsub),
    attachments: PUMPKIN,
    text:
`${name ? 'Hi ' + first(name) + ',' : 'Hi there,'}

Happy October!! Since you gave us your email on one of our forms, you get exclusive first access to our October meetup before we post it anywhere else.

We're doing a crochet class at South Florida Sewing Studio. An instructor will teach everyone to crochet their own bookmark, then we'll talk about Carmilla (the edition edited by Carmen Maria Machado).

${EVENT}

Tickets are $50 and there are only 23 spots. That covers a full 1 to 1.5 hour class with an instructor, your yarn and crochet hook, and printed instructions to take home if you don't finish in class.

How to save your spot:
1. Go to ${RESERVE} and fill out the short form.
2. You'll get an email that your spot is held for 48 hours.
3. Zelle $50 to Megan Smith at 954-806-3579 with your full name in the memo.
4. Once it comes through, we'll email you that you're officially in.

Hope to see you there,
Kaitlyn & Meg

You're getting this because you shared your email on a WellRed form. Unsubscribe: ${unsub}`,
  };
}
