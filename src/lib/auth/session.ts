import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";

// Access token: JWT de 15 minutos en Authorization: Bearer.
// Refresh token: 30 días en cookie httpOnly. Rota en cada uso; en la base se guarda solo el hash.

const ACCESS_TTL = "15m";
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const REFRESH_COOKIE = "ab_rt";
const COOKIE_PATH = "/api/v1/auth";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET falta o es muy corto (mínimo 32 caracteres)");
  return new TextEncoder().encode(s);
}

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");

export function signAccessToken(userId: string) {
  return new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime(ACCESS_TTL).sign(secret());
}

/** Devuelve el id del usuario del header Authorization o lanza 401. */
export async function requireUserId(req: Request): Promise<string> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new ApiError(401, "unauthorized", "Tenés que iniciar sesión.");
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) throw new Error("sin sub");
    return payload.sub;
  } catch (e) {
    if (e instanceof joseErrors.JWTExpired) throw new ApiError(401, "token_expired", "La sesión se renovará.");
    throw new ApiError(401, "unauthorized", "Tenés que iniciar sesión.");
  }
}

function refreshCookie(value: string, maxAgeSec: number) {
  const parts = [
    `${REFRESH_COOKIE}=${value}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAgeSec}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export const clearRefreshCookie = () => refreshCookie("", 0);

async function issueRefreshToken(userId: string) {
  const token = randomToken();
  const row = await prisma.refreshToken.create({
    data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  return { token, row };
}

/** Crea una sesión nueva: access token + cookie de refresh. */
export async function createSession(userId: string) {
  const [{ token }, accessToken] = await Promise.all([issueRefreshToken(userId), signAccessToken(userId)]);
  return { accessToken, cookie: refreshCookie(token, REFRESH_TTL_MS / 1000) };
}

export function readRefreshCookie(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(REFRESH_COOKIE.length + 1)) : null;
}

const sessionExpired = () => new ApiError(401, "session_expired", "Tu sesión venció.");

/**
 * Rota el refresh token. Si llega uno ya usado (posible robo), revoca todas las sesiones del usuario.
 */
export async function rotateSession(token: string | null) {
  if (!token) throw sessionExpired();
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row) throw sessionExpired();

  if (row.revokedAt) {
    await revokeAllSessions(row.userId);
    throw sessionExpired();
  }
  if (row.expiresAt < new Date()) throw sessionExpired();

  const user = await prisma.user.findFirst({ where: { id: row.userId, deletedAt: null }, select: { id: true } });
  if (!user) throw sessionExpired();

  const next = await issueRefreshToken(row.userId);
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date(), replacedBy: next.row.id } });

  return {
    userId: row.userId,
    accessToken: await signAccessToken(row.userId),
    cookie: refreshCookie(next.token, REFRESH_TTL_MS / 1000),
  };
}

export async function revokeSession(token: string | null) {
  if (!token) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Usuario tal como lo devuelve la API (snake_case, sin hash). */
export function toUserDto(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    theme: u.theme,
    display_currency: u.displayCurrency,
    rate_type: u.rateType,
    manual_rate: u.manualRate?.toString() ?? null,
    pay_strategy: u.payStrategy,
    alert_days: u.alertDays,
    mail_alerts: u.mailAlerts,
    push_enabled: u.pushEnabled,
    onboarded_at: u.onboardedAt?.toISOString() ?? null,
    last_month_opened: u.lastMonthOpened,
  };
}

export type UserDto = ReturnType<typeof toUserDto>;
