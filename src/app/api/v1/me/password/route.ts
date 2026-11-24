import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, handle, readBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { readRefreshCookie, requireUserId, sha256 } from "@/lib/auth/session";
import { MIN_PASSWORD } from "@/lib/auth/validate";

const Body = z.object({
  current: z.string().min(1, "Ingresá tu contraseña actual"),
  new: z.string().min(MIN_PASSWORD, "La nueva necesita al menos 8 caracteres").max(200),
});

// POST /me/password: cambia la contraseña. Cierra las demás sesiones (deja abierta la actual).
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  rateLimit(`pw:${clientIp(req)}:${userId}`);
  const b = await readBody(req, Body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, b.current))) throw new ApiError(400, "wrong_password", "La contraseña actual no coincide.");

  const keep = readRefreshCookie(req);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(b.new) } }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, ...(keep && { tokenHash: { not: sha256(keep) } }) },
      data: { revokedAt: new Date() },
    }),
  ]);
  return new Response(null, { status: 204 });
});
