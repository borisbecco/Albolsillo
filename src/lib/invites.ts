import { randomInt } from "node:crypto";
import type { Invite, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/mail";

type Db = Prisma.TransactionClient | typeof prisma;

// Registro solo por invitación: códigos XXXX-XXXX (sin 0/O/1/I), de un solo uso, vencen a los 14 días.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_TTL_DAYS = 14;
export const INVITE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})(.{4})$/, "$1-$2");

function newCode() {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${part()}-${part()}`;
}

export const inviteLink = (code: string) => `${appUrl()}/registro?invite=${code}`;

/** El registro exige código salvo que REGISTRATION_OPEN=1 (desarrollo y pruebas). */
export const invitesRequired = () => process.env.REGISTRATION_OPEN !== "1";

export function inviteStatus(i: Invite) {
  return i.status === "pending" && i.expiresAt < new Date() ? "expired" : i.status;
}

export function inviteDto(i: Invite) {
  return {
    id: i.id,
    email: i.email,
    code: i.code,
    status: inviteStatus(i),
    link: inviteLink(i.code),
    created_at: i.createdAt.toISOString(),
    expires_at: i.expiresAt.toISOString(),
  };
}

/** Crea un código nuevo (reintenta si choca con uno existente). */
export async function createInvite(db: Db, inviterId: string | null, email: string) {
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    if (await db.invite.findUnique({ where: { code } })) continue;
    return db.invite.create({
      data: { inviterId, email, code, expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000) },
    });
  }
  throw new Error("No se pudo generar un código de invitación");
}

/** Invitación vigente para un email (para reusar el código en vez de crear otro). */
export const activeInviteFor = (db: Db, email: string) =>
  db.invite.findFirst({ where: { email, status: "pending", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });

/** Valida un código; devuelve la invitación si sirve. */
export async function findValidInvite(db: Db, code: string) {
  const c = normalizeCode(code);
  if (!INVITE_RE.test(c)) return null;
  const inv = await db.invite.findUnique({ where: { code: c } });
  return inv && inviteStatus(inv) === "pending" ? inv : null;
}
