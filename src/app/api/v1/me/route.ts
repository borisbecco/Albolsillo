import { prisma } from "@/lib/db";
import { ApiError, handle } from "@/lib/http";
import { requireUserId, toUserDto } from "@/lib/auth/session";

export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new ApiError(401, "session_expired", "Tu sesión venció.");
  return Response.json({ user: toUserDto(user) });
});
