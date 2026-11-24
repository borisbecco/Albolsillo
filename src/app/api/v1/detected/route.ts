import { prisma } from "@/lib/db";
import { handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { detectedDto } from "@/lib/auto/detected";

/** GET /detected?status=pending: la bandeja de gastos detectados. */
export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  const rows = await prisma.detectedExpense.findMany({
    where: { userId, status: status === "confirmed" || status === "discarded" ? status : "pending" },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  return Response.json({ detected: rows.map(detectedDto) });
});
