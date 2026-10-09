// Restituisce la chiave pubblica per iscrivere il telefono alle notifiche
// e dice all'app se il server è configurato.
export default {
  fetch() {
    const key = process.env.VAPID_PUBLIC_KEY || null;
    const ready = Boolean(
      key &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.QSTASH_TOKEN &&
      process.env.QSTASH_CURRENT_SIGNING_KEY &&
      process.env.QSTASH_NEXT_SIGNING_KEY
    );
    return Response.json({ key, ready }, { headers: { "Cache-Control": "no-store" } });
  }
};
