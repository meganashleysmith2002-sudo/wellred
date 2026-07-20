// POST /api/vote  { month: '2026-08', id: 'c', previous: 'a' | null }
// Records a vote in Upstash Redis and returns the updated counts.
// Rejects votes after the month's close date and unknown option ids —
// so "once it closes, no one else can vote" is enforced on the server,
// not just in the browser.

// ---- Keep in sync with the POLLS config in index.html ----
const CLOSES = {
  '2026-08': '2026-08-01T00:00:00-04:00',
};
const VALID = {
  '2026-08': ['a', 'b', 'c', 'd'],
};
// ----------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const month = String(body.month || '');
  const id = String(body.id || '');
  const previous = body.previous ? String(body.previous) : null;

  if (!CLOSES[month] || !VALID[month] || VALID[month].indexOf(id) === -1) {
    return res.status(400).json({ error: 'bad vote' });
  }
  if (Date.now() >= Date.parse(CLOSES[month])) {
    return res.status(403).json({ error: 'closed' });
  }
  if (!url || !token) {
    return res.status(200).json({ counts: {}, note: 'no store configured' });
  }

  const key = 'wellred:poll:' + month;
  const cmds = [['HINCRBY', key, id, '1']];
  if (previous && previous !== id && VALID[month].indexOf(previous) !== -1) {
    cmds.push(['HINCRBY', key, previous, '-1']); // moving a vote: undo the old one
  }

  try {
    await fetch(url + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
    });
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(['HGETALL', key]),
    });
    const data = await r.json();
    const flat = data.result || [];
    const counts = {};
    for (let i = 0; i < flat.length; i += 2) {
      counts[flat[i]] = parseInt(flat[i + 1], 10) || 0;
    }
    return res.status(200).json({ counts });
  } catch (e) {
    return res.status(500).json({ error: 'store error' });
  }
}
