// Programma, sposta o annulla la notifica di fine recupero.
// QStash richiama /api/push dopo "delay" secondi; un nuovo "start" con "id" annulla il precedente.
import { Client } from "@upstash/qstash";

const PUSH_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.mozilla\.com$/, /\.notify\.windows\.com$/];

function validSubscription(s) {
  if (!s || typeof s !== "object" || typeof s.endpoint !== "string" || !s.keys) return false;
  try {
    const u = new URL(s.endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some(r => r.test(u.hostname))
      && typeof s.keys.p256dh === "string" && typeof s.keys.auth === "string";
  } catch { return false; }
}

const clean = (v, max) => String(v || "").slice(0, max);

async function cancel(client, id) {
  if (!id || typeof id !== "string") return;
  try { await client.messages.delete(id); } catch { /* già consegnato o già annullato */ }
}

export default {
  async fetch(request) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    if (!process.env.QSTASH_TOKEN) return Response.json({ error: "QSTASH_TOKEN mancante" }, { status: 503 });

    let body;
    try { body = await request.json(); } catch { return Response.json({ error: "JSON non valido" }, { status: 400 }); }

    const client = new Client({ token: process.env.QSTASH_TOKEN, baseUrl: process.env.QSTASH_URL || undefined });

    if (body.action === "cancel") {
      await cancel(client, body.id);
      return Response.json({ ok: true });
    }

    if (body.action !== "start") return Response.json({ error: "Azione sconosciuta" }, { status: 400 });

    const delay = Math.round(Number(body.delay));
    if (!Number.isFinite(delay) || delay < 1 || delay > 3600) {
      return Response.json({ error: "delay deve essere tra 1 e 3600 secondi" }, { status: 400 });
    }
    if (!validSubscription(body.subscription)) {
      return Response.json({ error: "Iscrizione alle notifiche non valida" }, { status: 400 });
    }

    await cancel(client, body.id);

    const origin = process.env.PUBLIC_URL || new URL(request.url).origin;
    const res = await client.publishJSON({
      url: `${origin}/api/push`,
      delay,
      retries: 0,
      body: {
        subscription: {
          endpoint: body.subscription.endpoint,
          keys: { p256dh: body.subscription.keys.p256dh, auth: body.subscription.keys.auth }
        },
        title: clean(body.title, 80) || "Recupero finito",
        body: clean(body.body, 160) || "Si riparte"
      }
    });

    return Response.json({ id: res.messageId });
  }
};
