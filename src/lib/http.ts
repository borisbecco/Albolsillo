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
export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
