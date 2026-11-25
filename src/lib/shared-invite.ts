import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { appUrl, sendInvite } from "@/lib/mail";
import { activeInviteFor, createInvite } from "@/lib/invites";
import { randomToken } from "@/lib/auth/session";
import { MONTH_SHORT } from "@/lib/month";
import { balances, sharedDto } from "@/lib/shared";

// Invitaciones a gastos compartidos (las invitaciones a la app están en invites.ts).

/** Marca el contacto como invitado, le genera un token y le manda el mail "invitacion". */
export async function invitePerson(userId: string, personId: string, email: string) {
  const [user, person] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.person.findFirst({ where: { id: personId, userId, deletedAt: null } }),
  ]);
  if (!person) throw new ApiError(404, "not_found", "No encontramos ese contacto.");

  // Si ya usa Albolsillo con ese email, queda vinculado.
  const linked = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } });
  const token = person.inviteToken ?? randomToken();
  const updated = await prisma.person.update({
    where: { id: personId },
    data: { email, inviteToken: token, invitedAt: new Date(), status: linked ? "user" : "invited", linkedUserId: linked?.id ?? null },
  });

  // Registro por invitación: si todavía no usa la app, se le genera un código (no gasta el cupo del usuario).
  if (!linked && !(await activeInviteFor(prisma, email))) await createInvite(prisma, null, email);

  const expenses = await prisma.sharedExpense.findMany({ where: { userId, deletedAt: null }, orderBy: { date: "desc" } });
  const list = expenses.map(sharedDto);
  const mine = list.filter((e) => e.kind === "expense" && e.participants.includes(personId)).slice(0, 4);
  const name = (id: string) => (id === "me" ? user.name.split(" ")[0] : id === personId ? person.name : "otra persona");
  // Desde el lado del invitado: lo que el usuario dice que le deben, el invitado lo debe.
  const balance = balances(list)[personId] ?? 0;

  const mailSent = await sendInvite({
    to: email,
    inviterName: user.name,
    inviterEmail: user.email,
    token,
    balance,
    rows: mine.map((e) => ({
      description: e.description,
      payer: name(e.paid_by),
      among: e.participants.length,
      dateLabel: `${Number(e.date.slice(8))} ${MONTH_SHORT[Number(e.date.slice(5, 7)) - 1]}`,
      share: Number(e.total) / e.participants.length,
    })),
  }).catch(() => false);
  return { person: updated, mailSent, link: `${appUrl()}/invitacion/${token}` };
}
