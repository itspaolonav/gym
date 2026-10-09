// Chiamata da QStash allo scadere del recupero: invia la notifica al telefono.
import { Receiver } from "@upstash/qstash";
import webpush from "web-push";

export default {
  async fetch(request) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const raw = await request.text();
    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY
    });
    try {
      const ok = await receiver.verify({ signature: request.headers.get("upstash-signature") || "", body: raw });
      if (!ok) return new Response("Firma non valida", { status: 401 });
    } catch {
      return new Response("Firma non valida", { status: 401 });
    }

    let msg;
    try { msg = JSON.parse(raw); } catch { return new Response("JSON non valido", { status: 400 }); }

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:ripartenza@example.com",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    try {
      await webpush.sendNotification(
        msg.subscription,
        JSON.stringify({ title: msg.title, body: msg.body }),
        { TTL: 120, urgency: "high" }
      );
    } catch (err) {
      // 404/410: il telefono non è più iscritto. In ogni caso non ha senso ritentare una notifica in ritardo.
      console.error("Invio notifica fallito", err && err.statusCode, err && err.body);
    }
    return new Response("ok");
  }
};
