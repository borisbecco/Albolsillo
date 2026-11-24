import { prisma } from "@/lib/db";
import { ApiError, handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /sources/:id: desactiva la dirección; lo que llegue después se descarta. */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const s = await prisma.expenseSource.findFirst({ where: { id, userId } });
  if (!s) throw new ApiError(404, "not_found", "No encontramos esa fuente.");
  await prisma.expenseSource.update({ where: { id }, data: { status: "disabled", confirmationCode: null, confirmationLink: null } });
  return new Response(null, { status: 204 });
});
