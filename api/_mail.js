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

export async function send({ to, subject, text, replyTo }) {
  const t = getTransport();
  if (!t || !to) return { skipped: true };
  try {
    await withTimeout(t.sendMail({
      from: 'WellRed <' + FROM_ADDR + '>',
      to, subject, text,
      replyTo: replyTo || FROM_ADDR,
    }), 8000);
    return { ok: true };
  } catch (e) {
    return { error: String(e && e.message || e) };
  }
}

const first = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';

const EVENT = 'Saturday, October 24, 2 to 4 PM\nSouth Florida Sewing Studio, 2629 N Federal Hwy, Fort Lauderdale';

export function heldEmail(s) {
  return {
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
