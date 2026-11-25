import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validate";
import { createInvite, inviteDto, inviteLink } from "@/lib/invites";
import { sendInviteCode } from "@/lib/mail";

async function listFor(userId: string) {
  const [user, rows] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { invitesQuota: true } }),
    prisma.invite.findMany({ where: { inviterId: userId }, orderBy: { createdAt: "desc" } }),
  ]);
  // Anular una invitación no devuelve el cupo.
  return { invites: rows.map(inviteDto), remaining: Math.max(0, user.invitesQuota - rows.length), quota: user.invitesQuota };
}

/** GET /invites: las invitaciones del usuario y cuántas le quedan. */
export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  return Response.json(await listFor(userId));
});

const Body = z.object({ email: z.string().refine(isValidEmail, "Revisá el email").transform(normalizeEmail) });

/** POST /invites { email }: crea el código, manda el mail y devuelve { code, link }. */
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const { email } = await readBody(req, Body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } })) {
    throw new ApiError(409, "already_user", "Esa persona ya usa Albolsillo.");
  }
  const mine = await prisma.invite.findFirst({ where: { inviterId: userId, email, status: "pending", expiresAt: { gt: new Date() } } });
  if (mine) throw new ApiError(409, "already_invited", "Ya tiene una invitación pendiente. Podés copiar el link de nuevo.");
  const { remaining } = await listFor(userId);
  if (remaining <= 0) throw new ApiError(403, "no_invites", "Ya usaste tus invitaciones.");

  const inv = await createInvite(prisma, userId, email);
  const mailSent = await sendInviteCode({ to: email, inviterName: user.name, code: inv.code, link: inviteLink(inv.code) }).catch(() => false);
  return Response.json({ code: inv.code, link: inviteLink(inv.code), mail_sent: mailSent, invite: inviteDto(inv), ...(await listFor(userId)) }, { status: 201 });
});
