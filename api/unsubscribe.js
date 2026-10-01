// Unsubscribe from WellRed emails.
// GET  /api/unsubscribe?t=TOKEN  -> a small page with one "Unsubscribe" button
//      (a button, not an instant unsubscribe, so email security scanners that
//      open links can't take people off the list by accident)
// POST /api/unsubscribe?t=TOKEN  -> takes them off the list
//      (also used by Gmail/Apple Mail's built-in one-click unsubscribe)
const UNSUB = 'wellred:unsub';
const TOKENS = 'wellred:unsub:tokens';

function page(title, body, button) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${title} · WellRed</title>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@600&family=EB+Garamond:wght@400;500&display=swap" rel="stylesheet">
<style>
body{margin:0;background:#F6EFE3;color:#241412;font-family:"EB Garamond",Georgia,serif;font-size:18px;line-height:1.5;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
.card{max-width:440px;width:100%;background:#FDFAF4;border:1px solid #D39D96;border-radius:18px;padding:32px 28px;text-align:center}
.brand{font-family:Lora,serif;font-weight:600;font-size:1.4rem;margin-bottom:14px}.brand b{color:#8C1C1C}
h1{font-family:Lora,serif;font-weight:600;font-size:1.6rem;margin:0 0 10px}
p{color:#6E514A;margin:0 0 18px}
button{font-family:Lora,serif;font-size:.8rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;background:#8C1C1C;color:#FCF4EC;border:0;border-radius:999px;padding:14px 26px;cursor:pointer}
a{color:#8C1C1C}
</style></head><body><div class="card"><div class="brand">Well<b>Red</b></div><h1>${title}</h1>${body}${button || ''}</div></body></html>`;
}

export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const t = String((req.query && req.query.t) || '').replace(/[^a-f0-9]/g, '').slice(0, 64);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const call = (cmd) => fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  }).then((r) => r.json());

  if (!t || !url || !token) {
    return res.status(400).send(page("That link didn't work", '<p>Reply to any of our emails and we\'ll take you off the list by hand.</p>'));
  }
  const found = await call(['HGET', TOKENS, t]);
  const email = found && found.result;
  if (!email) {
    return res.status(404).send(page("That link didn't work", '<p>Reply to any of our emails and we\'ll take you off the list by hand.</p>'));
  }

  if (req.method === 'POST') {
    await call(['SADD', UNSUB, email]);
    return res.status(200).send(page("You're unsubscribed", "<p>You won't get any more emails from us. If you change your mind, follow <a href=\"https://www.instagram.com/thewellredclub\">@thewellredclub</a> or come say hi at a meetup.</p>"));
  }

  const already = await call(['SISMEMBER', UNSUB, email]);
  if (already && already.result === 1) {
    return res.status(200).send(page("You're already unsubscribed", "<p>You won't get any more emails from us.</p>"));
  }
  return res.status(200).send(page('Unsubscribe from WellRed emails?',
    '<p>Tap the button and we\'ll take you off our list. No hard feelings.</p>',
    `<form method="post" action="/api/unsubscribe?t=${t}"><button type="submit">Unsubscribe</button></form>`));
}
