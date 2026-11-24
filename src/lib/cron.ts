import { timingSafeEqual } from "node:crypto";

/** Jobs programados: el Cron de Railway llama con "Authorization: Bearer $CRON_SECRET". */
export function cronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || secret.length < 16) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
