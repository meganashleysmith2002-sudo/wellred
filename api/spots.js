// Save-your-spot list for the Oct 24 crochet meetup at South Florida Sewing Studio.
// POST /api/spots {action:'hold', name, email, phone}          -> {ok, id, left}
// GET  /api/spots                                              -> {left, cap, closed}
// GET  /api/spots?key=PASSCODE                                   -> {spots, cap, left}
// POST /api/spots {action:'paid'|'release'|'restore'|'remove', key, id, paid?}
// A hold lasts 48 hours. Paid spots never expire. Storage: the site's Upstash Redis.
import { send, heldEmail, paidEmail, hostEmail } from './_mail.js';

// Phone push alert through the free ntfy app. The private channel name lives in
// the Vercel env var NTFY_TOPIC (never in this public code). No topic set = no push.
async function pushAlert(title, message) {
  const topic = (process.env.NTFY_TOPIC || '').trim();
  if (!topic) return;
  try {
    await Promise.race([
      fetch('https://ntfy.sh/' + encodeURIComponent(topic), {
        method: 'POST',
        headers: { Title: title, Tags: 'books', Click: 'https://wellred.club/needle-velvet-1024', Priority: 'high' },
        body: message,
      }),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  } catch (e) {}
}

const KEY = 'wellred:event:2026-10-24:spots';
// Host passcode lives in the Vercel env var HOST_KEY, never in this public repo.
const SECRET = process.env.HOST_KEY || '';
const CAP = 25;
// Meg and Kaitlyn's own seats, counted as taken.
const RESERVED = 2;
const HOLD_MS = 48 * 60 * 60 * 1000;
const CLOSES = Date.parse('2026-10-24T14:00:00-04:00');

function isActive(s, now) {
  if (s.removed) return false;
  if (s.paid) return true;
  if (s.released) return false;
  return now - Date.parse(s.t) < HOLD_MS;
}

export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(200).json({ error: 'no store configured' });
  res.setHeader('Cache-Control', 'no-store');

  const call = (cmd) => fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  }).then((r) => r.json());

  const load = async () => {
    const r = await call(['HGETALL', KEY]);
    const flat = r.result || [];
    const out = [];
    for (let i = 0; i < flat.length; i += 2) {
      try { out.push(JSON.parse(flat[i + 1])); } catch (e) {}
    }
    out.sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
    return out;
  };
  const save = (s) => call(['HSET', KEY, s.id, JSON.stringify(s)]);

  const now = Date.now();

  if (req.method === 'GET') {
    const spots = await load();
    const taken = spots.filter((s) => isActive(s, now)).length + RESERVED;
    const left = Math.max(0, CAP - taken);
    if (req.query.check) {
      const mine = spots.find((x) => x.id === String(req.query.check));
      return res.status(200).json({ active: !!(mine && isActive(mine, now)), paid: !!(mine && mine.paid), left, cap: CAP });
    }
    if (SECRET && (req.query.key || '') === SECRET) {
      return res.status(200).json({ spots, cap: CAP, left, reserved: RESERVED, holdHours: 48 });
    }
    return res.status(200).json({ left, cap: CAP, closed: now >= CLOSES });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  if (body.action === 'hold') {
    if (now >= CLOSES) return res.status(403).json({ error: 'closed' });
    const name = String(body.name || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 160);
    const phone = String(body.phone || '').trim().slice(0, 40);
    const src = String(body.src || '').replace(/[^\w\-\/.]/g, '').slice(0, 60);
    if (name.length < 3 || name.indexOf(' ') === -1) return res.status(400).json({ error: 'name' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'email' });
    if (phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'phone' });

    const spots = await load();
    const mine = spots.find((s) => s.email === email && isActive(s, now));
    const taken = spots.filter((s) => isActive(s, now)).length + RESERVED;
    if (mine) return res.status(200).json({ ok: true, id: mine.id, t: mine.t, again: true, left: Math.max(0, CAP - taken) });
    if (taken >= CAP) return res.status(409).json({ error: 'full', left: 0 });

    const s = {
      id: 's' + now.toString(36) + Math.random().toString(36).slice(2, 6),
      name, email, phone, src,
      t: new Date(now).toISOString(),
      paid: false,
    };
    const left = Math.max(0, CAP - taken - 1);
    const [a] = await Promise.all([
      send(heldEmail(s)),
      send(hostEmail(s, left, CAP)),
      pushAlert('New WellRed sign-up', s.name + ' saved a spot. ' + left + ' of ' + CAP + ' left. Waiting on Zelle.'),
    ]);
    if (a && a.ok) s.heldEmailAt = new Date().toISOString();
    await save(s);
    return res.status(200).json({ ok: true, id: s.id, t: s.t, left });
  }

  if (!SECRET || body.key !== SECRET) return res.status(403).json({ error: 'nope' });
  const spots = await load();
  const s = spots.find((x) => x.id === body.id);
  if (!s) return res.status(404).json({ error: 'not found' });

  if (body.action === 'paid') {
    s.paid = !!body.paid;
    s.paidAt = s.paid ? new Date(now).toISOString() : null;
    if (s.paid) s.released = false;
    if (s.paid && !s.paidEmailAt) {
      const r = await send(paidEmail(s));
      if (r.ok) s.paidEmailAt = new Date().toISOString();
      else s.paidEmailError = r.off ? 'emails switched off for now' : r.skipped ? 'email not set up' : r.error;
    }
  } else if (body.action === 'release') {
    s.released = true; s.paid = false;
  } else if (body.action === 'restore') {
    s.released = false; s.t = new Date(now).toISOString();
  } else if (body.action === 'resend') {
    const r = await send(paidEmail(s));
    if (r.ok) { s.paidEmailAt = new Date().toISOString(); s.paidEmailError = null; }
    else s.paidEmailError = r.off ? 'emails switched off for now' : r.skipped ? 'email not set up' : r.error;
  } else if (body.action === 'confirmed') {
    s.confirmedAt = new Date(now).toISOString();
  } else if (body.action === 'remove') {
    s.removed = true; s.paid = false;
  } else {
    return res.status(400).json({ error: 'bad action' });
  }
  await save(s);
  return res.status(200).json({ ok: true, spot: s });
}
