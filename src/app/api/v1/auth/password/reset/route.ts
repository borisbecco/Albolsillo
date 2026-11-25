import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, handle, readBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllSessions, sha256 } from "@/lib/auth/session";
import { MIN_PASSWORD, MSG } from "@/lib/auth/validate";

const Body = z.object({
  token: z.string().min(1),
  password: z.string().min(MIN_PASSWORD, MSG.resetPass).max(200),
});

export const POST = handle(async (req: Request) => {
  rateLimit(`reset:${clientIp(req)}`, 10);
  const { token, password } = await readBody(req, Body);

  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
  if (!reset || reset.usedAt) throw new ApiError(400, "token_invalid", "Este link ya no sirve. Pedí uno nuevo.");
  if (reset.expiresAt < new Date()) throw new ApiError(410, "token_expired", "El link venció. Pedí uno nuevo.");

  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
  ]);
  // Cierra las sesiones abiertas con la contraseña anterior.
  await revokeAllSessions(reset.userId);

  return new Response(null, { status: 204 });
});
