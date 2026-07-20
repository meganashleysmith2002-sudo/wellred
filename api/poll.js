// GET /api/poll?month=2026-08  ->  { counts: { a: 12, b: 31, ... } }
// Reads the monthly tally from Upstash Redis (Vercel Marketplace).
// No npm packages needed — talks to the Upstash REST API directly.

export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  const month = String((req.query && req.query.month) || '');
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'bad month' });
  }

  // No store connected yet: return empty so the site still renders.
  if (!url || !token) {
    return res.status(200).json({ counts: {}, note: 'no store configured' });
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(['HGETALL', 'wellred:poll:' + month]),
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
