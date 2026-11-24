import { prisma } from "@/lib/db";
import { handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";

/** GET /merchant-rules: las categorías aprendidas del usuario. */
export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const rows = await prisma.merchantRule.findMany({ where: { userId }, orderBy: { merchantLabel: "asc" } });
  return Response.json({ rules: rows.map((r) => ({ id: r.id, merchant_key: r.merchantKey, merchant_label: r.merchantLabel, category_id: r.categoryId })) });
});
