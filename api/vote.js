import { kv } from '@vercel/kv';

const OPTIONS = ['a', 'b', 'c', 'd'];
const HASH = 'wellred:poll';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
          const body =
                  typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
          const id = body.id;
          const previous = body.previous;
          if (!OPTIONS.includes(id)) {
                  return res.status(400).json({ error: 'Invalid option' });
          }
          if (previous && OPTIONS.includes(previous) && previous !== id) {
                  const prevCount = Number((await kv.hget(HASH, previous)) || 0);
                  if (prevCount > 0) {
                            await kv.hincrby(HASH, previous, -1);
                  }
          }
          if (previous !== id) {
                  await kv.hincrby(HASH, id, 1);
          }
          const raw = await kv.hmget(HASH, ...OPTIONS);
          const counts = {};
          OPTIONS.forEach((o) => {
                  const v = raw && raw[o] != null ? Number(raw[o]) : 0;
                  counts[o] = Number.isFinite(v) ? v : 0;
          });
          res.setHeader('Cache-Control', 'no-store');
          return res.status(200).json({ counts });
    } catch (err) {
          return res.status(500).json({ error: 'Could not record vote' });
    }
}
