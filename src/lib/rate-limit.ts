import { ApiError } from "@/lib/http";

// Ventana fija en memoria. Alcanza con una sola instancia en Railway;
// si se escala a varias réplicas, hay que pasarlo a Postgres o Redis.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 5, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else if (++b.count > limit) {
    throw new ApiError(429, "rate_limited", "Probaste muchas veces. Esperá un minuto y volvé a intentar.");
  }
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
}
