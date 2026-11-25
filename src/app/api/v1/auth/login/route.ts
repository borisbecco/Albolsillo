import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, handle, readBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { dummyHash, verifyPassword } from "@/lib/auth/password";
import { createSession, toUserDto } from "@/lib/auth/session";
import { MSG, normalizeEmail } from "@/lib/auth/validate";

const Body = z.object({
  email: z.string().trim().min(1, MSG.loginEmail).transform(normalizeEmail),
  password: z.string().min(1, MSG.loginPass).max(200),
});

export const POST = handle(async (req: Request) => {
  const body = await readBody(req, Body);
  rateLimit(`login:${clientIp(req)}:${body.email}`);
  // Y en total por conexión (probar muchas cuentas desde el mismo lugar).
  rateLimit(`login-ip:${clientIp(req)}`, 30);

  const user = await prisma.user.findFirst({ where: { email: body.email, deletedAt: null } });
  const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash()), body.password);
  if (!user || !ok) throw new ApiError(401, "invalid_credentials", "El email o la contraseña no coinciden.");

  const session = await createSession(user.id);
  return Response.json(
    { user: toUserDto(user), access_token: session.accessToken },
    { headers: { "Set-Cookie": session.cookie } },
  );
});
