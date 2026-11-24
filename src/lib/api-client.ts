"use client";

// Cliente de la API. El access token vive solo en memoria; el refresh token, en una cookie httpOnly.
// Si una llamada da 401, renueva una vez con /auth/refresh y reintenta. Si eso falla, la sesión venció.

const BASE = "/api/v1";

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const hasAccessToken = () => accessToken !== null;

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const SESSION_EXPIRED_EVENT = "albolsillo:session-expired";

/** Pide un access token nuevo. Una sola llamada a la vez aunque haya varias en curso. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "same-origin" })
    .then(async (r) => {
      if (!r.ok) return false;
      const data = (await r.json()) as { access_token: string };
      accessToken = data.access_token;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function toError(res: Response) {
  try {
    const body = (await res.json()) as { error?: { code: string; message: string } };
    if (body.error) return new ApiClientError(res.status, body.error.code, body.error.message);
  } catch {}
  return new ApiClientError(res.status, "http_error", "Algo salió mal. Probá de nuevo en un rato.");
}

function request(path: string, init: RequestInit) {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${BASE}${path}`, { ...init, headers, credentials: "same-origin" });
}

/** Llama a la API y devuelve el JSON (o null en 202/204). Lanza ApiClientError. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await request(path, init);

  if (res.status === 401 && !path.startsWith("/auth/")) {
    if (await refreshSession()) {
      res = await request(path, init);
    } else {
      accessToken = null;
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      throw new ApiClientError(401, "session_expired", "Tu sesión venció.");
    }
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 202 || res.status === 204) return null as T;
  return (await res.json()) as T;
}

/** Descarga un archivo de la API (CSV, PDF) con la sesión actual. */
export async function download(path: string, filename: string) {
  let res = await request(path, { method: "GET" });
  if (res.status === 401 && (await refreshSession())) res = await request(path, { method: "GET" });
  if (!res.ok) throw await toError(res);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const post =<T = unknown>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export async function logout() {
  try {
    await post("/auth/logout");
  } finally {
    accessToken = null;
  }
}
