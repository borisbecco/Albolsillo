import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";

/** Error de API con el formato { error: { code, message } }. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/** Envuelve un handler y convierte ApiError (y errores inesperados) en respuestas JSON. */
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      // Deja pasar los errores internos de Next (p. ej. el que marca una ruta como dinámica).
      unstable_rethrow(e);
      if (e instanceof ApiError) return errorResponse(e.status, e.code, e.message);
      console.error(e);
      return errorResponse(500, "internal", "Algo salió mal. Probá de nuevo en un rato.");
    }
  };
}

/** Lee el body JSON y lo valida. El primer mensaje de zod es el que ve el usuario. */
export async function readBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "invalid_body", "No pudimos leer los datos enviados.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(400, "validation", parsed.error.issues[0]?.message ?? "Revisá los datos.");
  }
  return parsed.data;
}

/** IP del cliente detrás del proxy de Railway. */
/**
 * IP del cliente para los límites de intentos. El primer valor de X-Forwarded-For lo puede inventar
 * el cliente (y saltearse los límites): se usa X-Real-IP, que pone el proxy de Railway, o si no el
 * último valor de X-Forwarded-For (el que agregó el último proxy).
 */
export function clientIp(req: Request) {
  return req.headers.get("x-real-ip")?.trim() || req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
}
