import { kv } from '@vercel/kv';

const OPTIONS = ['a', 'b', 'c', 'd'];

export default async function handler(req, res) {
    try {
          const raw = await kv.hmget('wellred:poll', ...OPTIONS);
          const counts = {};
          OPTIONS.forEach((id) => {
                  const v = raw && raw[id] != null ? Number(raw[id]) : 0;
                  counts[id] = Number.isFinite(v) ? v : 0;
          });
          res.setHeader('Cache-Control', 'no-store');
          return res.status(200).json({ counts });
    } catch (err) {
          return res.status(500).json({ error: 'Could not load poll' });
    }
}
