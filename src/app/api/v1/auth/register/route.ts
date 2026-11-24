import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { hashPassword } from "@/lib/auth/password";
import { createSession, toUserDto } from "@/lib/auth/session";
import { MIN_PASSWORD, MSG, isValidEmail, normalizeEmail } from "@/lib/auth/validate";

const Body = z.object({
  name: z.string().trim().min(1, MSG.regName).max(80),
  email: z.string().refine(isValidEmail, MSG.regEmail).transform(normalizeEmail),
  password: z.string().min(MIN_PASSWORD, MSG.regPass).max(200),
  accept_terms: z.literal(true, { message: MSG.regTerms }),
});

export const POST = handle(async (req: Request) => {
  const body = await readBody(req, Body);

  const exists = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
  if (exists) throw new ApiError(409, "email_taken", "Ya hay una cuenta con ese email. Probá entrar.");

  const user = await prisma.user.create({
    data: { name: body.name, email: body.email, passwordHash: await hashPassword(body.password) },
  });

  const session = await createSession(user.id);
  return Response.json(
    { user: toUserDto(user), access_token: session.accessToken },
    { status: 201, headers: { "Set-Cookie": session.cookie } },
  );
});
