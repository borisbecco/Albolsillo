import { prisma } from "@/lib/db";
import { handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { sourceDto } from "@/lib/auto/sources";
import { GMAIL_FILTER, PAYMENT_SENDERS } from "@/lib/auto/parse";

/** GET /sources: fuentes activas, la lista de billeteras que reconocemos y si se anotó para Android. */
export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const [rows, user] = await Promise.all([
    prisma.expenseSource.findMany({ where: { userId, status: { not: "disabled" } }, orderBy: { createdAt: "desc" } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { androidWaitlist: true } }),
  ]);
  return Response.json({
    sources: rows.map(sourceDto),
    wallets: [...new Map(PAYMENT_SENDERS.map((s) => [s.wallet, { name: s.wallet, domain: s.domain }])).values()],
    gmail_filter: GMAIL_FILTER,
    android_waitlist: user.androidWaitlist,
  });
});
