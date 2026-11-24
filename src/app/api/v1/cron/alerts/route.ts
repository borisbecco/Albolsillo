import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { ApiError, handle } from "@/lib/http";
import { appUrl, sendDailySummary, sendDueNotice } from "@/lib/mail";
import { buildNotice, todayAR, unsubscribeToken } from "@/lib/notify";
import { pushToUser } from "@/lib/push";

// POST /cron/alerts: job diario (8:00 de Argentina = 11:00 UTC). Lo llama el Cron de Railway con
// "Authorization: Bearer $CRON_SECRET". Manda los avisos de vencimiento por mail y push.

const STRATEGY = { intereses: "Evitar intereses", avalancha: "Avalancha", bola: "Bola de nieve" } as Record<string, string>;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || secret.length < 16) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const POST = handle(async (req: Request) => {
  if (!authorized(req)) throw new ApiError(401, "unauthorized", "No autorizado.");
  const today = new URL(req.url).searchParams.get("today") ?? todayAR();

  const users = await prisma.user.findMany({
    where: { deletedAt: null, onboardedAt: { not: null }, OR: [{ mailAlerts: { not: "off" } }, { pushEnabled: true }] },
    select: { id: true },
  });

  const stats = { users: users.length, notified: 0, mails: 0, pushes: 0, errors: 0 };
  for (const { id } of users) {
    try {
      const n = await buildNotice(id, today);
      if (!n) continue;
      stats.notified++;
      const u = n.user;
      if (u.mailAlerts === "each") {
        for (const item of n.due) {
          await sendDueNotice(u.email, today, item, STRATEGY[u.payStrategy] ?? "", u.alertDays);
          stats.mails++;
        }
      } else if (u.mailAlerts === "daily") {
        await sendDailySummary({
          to: u.email,
          name: u.name,
          today,
          spentYesterday: n.spentYesterday,
          available: n.available,
          due: n.due,
          budgetAlerts: n.budgetAlerts,
          unsubscribeUrl: `${appUrl()}/baja?t=${unsubscribeToken(u.id)}`,
        });
        stats.mails++;
      }
      if (u.pushEnabled && n.due.length) {
        const first = n.due[0];
        const when = first.daysLeft === 0 ? "hoy" : first.daysLeft === 1 ? "mañana" : `en ${first.daysLeft} días`;
        stats.pushes += await pushToUser(u.id, {
          title: n.due.length === 1 ? `${first.name} vence ${when}` : `Tenés ${n.due.length} vencimientos cerca`,
          body: n.due
            .slice(0, 3)
            .map((d) => `${d.name}: $ ${Math.round(d.amount).toLocaleString("es-AR")}`)
            .join(" · "),
          url: "/vencimientos",
        });
      }
    } catch (e) {
      stats.errors++;
      console.error("[cron] error con un usuario", e);
    }
  }
  return Response.json({ today, ...stats });
});
