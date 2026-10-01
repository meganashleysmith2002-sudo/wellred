// October early-access email to everyone who left an email on the Aug/Sept and October forms.
// All actions need the host passcode (HOST_KEY env var).
// POST {key, action:'list'}            -> {total, sent, remaining, recipients:[{email,name,sent}]}
// POST {key, action:'test'}            -> sends all three emails, marked [TEST], to each NOTIFY_TO address
// POST {key, action:'send'}            -> sends to up to 12 not-yet-sent people; call again until remaining = 0
import { send, earlyEmail, heldEmail, paidEmail } from './_mail.js';

const SOURCES = ['wellred:event:2026-08-29:feedback', 'wellred:event:2026-10:feedback'];
const SENT = 'wellred:blast:2026-10-early:sent';
const BATCH = 12;

export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const SECRET = process.env.HOST_KEY || '';
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  if (!SECRET || body.key !== SECRET) return res.status(403).json({ error: 'nope' });
  if (!url || !token) return res.status(200).json({ error: 'no store configured' });

  const call = (cmd) => fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  }).then((r) => r.json());

  // Build the deduped recipient list.
  const byEmail = new Map();
  for (const key of SOURCES) {
    const r = await call(['LRANGE', key, '0', '-1']);
    for (const raw of (r.result || [])) {
      let e; try { e = JSON.parse(raw); } catch (x) { continue; }
      const email = String(e.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
      const prev = byEmail.get(email);
      if (!prev || (!prev.name && e.name)) byEmail.set(email, { email, name: String(e.name || '').trim() });
    }
  }
  const sentR = await call(['SMEMBERS', SENT]);
  const sentSet = new Set(sentR.result || []);
  const recipients = [...byEmail.values()].map((x) => ({ ...x, sent: sentSet.has(x.email) }));
  const remaining = recipients.filter((x) => !x.sent);

  if (body.action === 'list') {
    return res.status(200).json({ total: recipients.length, sent: recipients.length - remaining.length, remaining: remaining.length, recipients });
  }

  if (body.action === 'test') {
    const to = (process.env.NOTIFY_TO || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (!to.length) return res.status(400).json({ error: 'NOTIFY_TO not set' });
    const results = [];
    for (const t of to) {
      const sample = { name: 'Test Reader', email: t };
      for (const [label, msg] of [['early access', earlyEmail(t, '')], ['spot held', heldEmail(sample)], ["you're in", paidEmail(sample)]]) {
        msg.subject = '[TEST] ' + msg.subject;
        results.push({ to: t, email: label, ...(await send(msg, { test: true })) });
      }
    }
    return res.status(200).json({ ok: results.every((r) => r.ok), results });
  }

  if (body.action === 'send') {
    const batch = remaining.slice(0, BATCH);
    const results = [];
    for (const r of batch) {
      const out = await send(earlyEmail(r.email, r.name));
      if (out.ok) await call(['SADD', SENT, r.email]);
      results.push({ email: r.email, ok: !!out.ok, error: out.error || (out.off ? 'emails are switched off until you approve' : out.skipped ? 'email not set up' : null) });
      if (out.skipped) break;
    }
    const left = remaining.length - results.filter((r) => r.ok).length;
    return res.status(200).json({ ok: true, sentNow: results.filter((r) => r.ok).length, remaining: left, results });
  }

  return res.status(400).json({ error: 'bad action' });
}
