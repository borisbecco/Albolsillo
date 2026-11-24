import { z } from "zod";
import { prisma } from "@/lib/db";
import { clientIp, handle, readBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { sendPasswordReset } from "@/lib/mail";
import { randomToken, sha256 } from "@/lib/auth/session";
import { MSG, isValidEmail, normalizeEmail } from "@/lib/auth/validate";

const RESET_TTL_MS = 30 * 60 * 1000;

const Body = z.object({
  email: z.string().refine(isValidEmail, MSG.forgotEmail).transform(normalizeEmail),
});

// Siempre 202, exista o no la cuenta, para no revelar qué emails están registrados.
export const POST = handle(async (req: Request) => {
  const { email } = await readBody(req, Body);
  rateLimit(`forgot:${clientIp(req)}:${email}`);

  const user = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true, email: true } });
  if (user) {
    const token = randomToken();
    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    await sendPasswordReset(user.email, token, req.headers.get("user-agent"));
  }

  return new Response(null, { status: 202 });
});
