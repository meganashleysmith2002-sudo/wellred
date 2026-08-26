// POST /api/event {action:'vote'|'feedback'|'reset', ...}
// GET  /api/event?key=SECRET  -> {counts, feedback}
// Storage: Upstash Redis via the same env vars api/vote.js uses.
const VALID = ['house', 'plow', 'gothic', 'fruitfly'];
const KEY_VOTES = 'wellred:event:2026-08-29:votes';
const KEY_FEED = 'wellred:event:2026-08-29:feedback';
const SECRET = 'cellar-vellum-606';
const FIELDS = ['name','city','email','age','found','loved','improve','lookfor','spot','books','ticket','price','activity'];

export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(200).json({ error: 'no store configured' });

  const call = (cmd) => fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  }).then((r) => r.json());

  if (req.method === 'GET') {
    if ((req.query.key || '') !== SECRET) return res.status(403).json({ error: 'nope' });
    const v = await call(['HGETALL', KEY_VOTES]);
    const f = await call(['LRANGE', KEY_FEED, '0', '-1']);
    const flat = v.result || [];
    const counts = {};
    for (let i = 0; i < flat.length; i += 2) counts[flat[i]] = parseInt(flat[i + 1], 10) || 0;
    const feedback = (f.result || []).map((s) => {
      try { return JSON.parse(s); } catch (e) { return null; }
    }).filter(Boolean);
    return res.status(200).json({ counts, feedback });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  if (body.action === 'vote') {
    const id = String(body.id || '');
    const prev = body.previous ? String(body.previous) : null;
    if (VALID.indexOf(id) === -1) return res.status(400).json({ error: 'bad vote' });
    const cmds = [['HINCRBY', KEY_VOTES, id, '1']];
    if (prev && prev !== id && VALID.indexOf(prev) !== -1) cmds.push(['HINCRBY', KEY_VOTES, prev, '-1']);
    await fetch(url + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
    });
    return res.status(200).json({ ok: true });
  }

  if (body.action === 'feedback') {
    const e = body.entry || {};
    const entry = { t: new Date().toISOString() };
    let any = false;
    for (const k of FIELDS) {
      if (e[k]) { entry[k] = String(e[k]).slice(0, 1000); any = true; }
    }
    if (!any) return res.status(400).json({ error: 'empty' });
    await call(['RPUSH', KEY_FEED, JSON.stringify(entry)]);
    return res.status(200).json({ ok: true });
  }

  if (body.action === 'reset' && body.key === SECRET) {
    await call(['DEL', KEY_VOTES]);
    await call(['DEL', KEY_FEED]);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'bad action' });
}
