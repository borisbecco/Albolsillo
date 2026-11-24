import * as webpush from "web-push";
import { prisma } from "@/lib/db";

// Web Push con claves VAPID. Sin claves configuradas, no se manda nada.

let configured: boolean | null = null;

function setup() {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:ayuda@albolsillo.app", pub!, priv!);
  return configured;
}

/** Manda una notificación a todos los dispositivos del usuario. Borra las suscripciones vencidas. */
export async function pushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!setup()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        else console.warn("[push] error", code);
      }
    }),
  );
  return sent;
}
