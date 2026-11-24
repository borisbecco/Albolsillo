import { prisma } from "@/lib/db";
import { handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";

/** GET /sources/forward/confirmation: el código de confirmación de Gmail, si ya llegó (la guía consulta cada 3 s). */
export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const s = await prisma.expenseSource.findFirst({ where: { userId, kind: "forward", status: { not: "disabled" } } });
  return Response.json({
    code: s?.confirmationCode ?? null,
    link: s?.confirmationLink ?? null,
    status: s?.status ?? null,
    last_received_at: s?.lastReceivedAt?.toISOString() ?? null,
  });
});
