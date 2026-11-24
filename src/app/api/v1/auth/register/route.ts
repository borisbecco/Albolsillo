import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { hashPassword } from "@/lib/auth/password";
import { createSession, toUserDto } from "@/lib/auth/session";
import { findValidInvite, invitesRequired } from "@/lib/invites";
import { MIN_PASSWORD, MSG, isValidEmail, normalizeEmail } from "@/lib/auth/validate";

const Body = z.object({
  name: z.string().trim().min(1, MSG.regName).max(80),
  email: z.string().refine(isValidEmail, MSG.regEmail).transform(normalizeEmail),
  password: z.string().min(MIN_PASSWORD, MSG.regPass).max(200),
  accept_terms: z.literal(true, { message: MSG.regTerms }),
  invite_code: z.string().max(20).optional(),
});

export const POST = handle(async (req: Request) => {
  const body = await readBody(req, Body);

  const exists = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
  if (exists) throw new ApiError(409, "email_taken", "Ya hay una cuenta con ese email. Probá entrar.");

  // Registro por invitación: el código tiene que existir, estar pendiente y no vencido.
  const invite = body.invite_code ? await findValidInvite(prisma, body.invite_code) : null;
  if (invitesRequired() && !invite) {
    throw new ApiError(
      422,
      "invite_invalid",
      body.invite_code ? "Ese código no sirve: venció, ya se usó o está mal escrito." : "Para crear una cuenta necesitás un código de invitación.",
    );
  }

  const passwordHash = await hashPassword(body.password);
  const user = await prisma.$transaction(async (db) => {
    const u = await db.user.create({
      data: { name: body.name, email: body.email, passwordHash, invitedById: invite?.inviterId ?? null },
    });
    if (invite) {
      const used = await db.invite.updateMany({ where: { id: invite.id, status: "pending" }, data: { status: "joined", joinedUserId: u.id } });
      if (!used.count && invitesRequired()) throw new ApiError(422, "invite_invalid", "Ese código ya se usó.");
    }
    return u;
  });

  // Si alguien lo había invitado con este email, sus contactos quedan vinculados.
  await prisma.person.updateMany({ where: { email: body.email, deletedAt: null, linkedUserId: null }, data: { status: "user", linkedUserId: user.id } });

  const session = await createSession(user.id);
  return Response.json(
    { user: toUserDto(user), access_token: session.accessToken },
    { status: 201, headers: { "Set-Cookie": session.cookie } },
  );
});
