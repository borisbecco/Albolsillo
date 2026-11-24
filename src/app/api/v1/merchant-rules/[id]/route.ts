import { prisma } from "@/lib/db";
import { ApiError, handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /merchant-rules/:id: olvida una categoría aprendida. */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const r = await prisma.merchantRule.findFirst({ where: { id, userId } });
  if (!r) throw new ApiError(404, "not_found", "No encontramos esa regla.");
  await prisma.merchantRule.delete({ where: { id } });
  return new Response(null, { status: 204 });
});
