// Base compartida de las pruebas de pantalla (se corren con `npm run test:e2e`).
// Cada prueba crea su propio usuario @test.local; el lanzador los borra al terminar.

import { chromium } from "playwright-core";

export const BASE = process.env.E2E_BASE ?? "http://localhost:3123";
export const PASSWORD = "Clave123!";

/** Fecha de hoy en Argentina (AAAA-MM-DD) y ayudas para armar fechas del mes. */
export const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const [Y, M, D] = today.split("-").map(Number);
export const prevMonth = M === 1 ? `${Y - 1}-12` : `${Y}-${String(M - 1).padStart(2, "0")}`;
/** Día n de este mes (sin pasarse de hoy). */
export const day = (n) => `${today.slice(0, 7)}-${String(Math.min(n, D)).padStart(2, "0")}`;
export const dayOfMonth = D;

/** Registro de resultados: check() anota, finish() imprime y marca la salida. */
export function suite(name) {
  const log = [];
  const check = (n, ok, extra = "") => log.push(`${ok ? "OK  " : "FAIL"} ${n}${extra && !ok ? " · " + extra : ""}`);
  const finish = (err) => {
    console.log(`── ${name}`);
    console.log(log.join("\n"));
    if (err) console.error("ERROR", err.message ?? err);
    process.exitCode = err || log.some((l) => l.startsWith("FAIL")) ? 1 : 0;
  };
  return { check, finish };
}

/** Corre la prueba y garantiza que se cierre el navegador y se imprima el resultado. */
export async function run(name, fn) {
  const s = suite(name);
  const ctx = { browser: null, errors: [] };
  try {
    await fn({ ...s, ctx });
    s.finish();
  } catch (e) {
    s.finish(e);
  } finally {
    await ctx.browser?.close();
  }
}

async function json(res) {
  const t = await res.text();
  try {
    return t ? JSON.parse(t) : null;
  } catch {
    return t;
  }
}

/**
 * Crea un usuario por la API. Opciones:
 *  - onboarding: cuerpo de /me/onboarding, `"skip"` (por defecto) o `null` para dejarlo sin configurar.
 *  - tour: marca el recorrido como visto (por defecto true).
 */
export async function newUser(prefix, { onboarding = "skip", tour = true } = {}) {
  const email = `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}@test.local`;
  const reg = await json(
    await fetch(BASE + "/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Test", email, password: PASSWORD, accept_terms: true }),
    }),
  );
  if (!reg?.access_token) throw new Error("No se pudo registrar: " + JSON.stringify(reg));
  const token = reg.access_token;
  const call = async (method, path, body) => {
    const raw = body instanceof FormData || typeof body === "string";
    const res = await fetch(BASE + "/api/v1" + path, {
      method,
      headers: { ...(raw ? {} : { "content-type": "application/json" }), authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
    return { status: res.status, body: await json(res) };
  };
  const u = { email, token, call, get: async (path) => (await call("GET", path)).body, post: async (path, body) => (await call("POST", path, body)).body };
  let ob = null;
  if (onboarding === "skip") await call("POST", "/me/onboarding", { skipped: true });
  else if (onboarding) ob = (await call("POST", "/me/onboarding", onboarding)).body;
  if (tour) await call("PATCH", "/me", { tour_done: true });
  u.onboarding = ob;
  /** Crea una cuenta y la devuelve. */
  u.account = async (name, kind = "banco", balance = "500000", currency = "ARS") => (await u.post("/accounts", { name, kind, currency, balance })).account;
  /** Crea un movimiento (gasto en pesos de hoy, salvo lo que se pase). */
  u.tx = async (o) =>
    (await u.post("/transactions", { id: crypto.randomUUID(), type: "out", date: today, currency: "ARS", card_id: null, recurring: false, category_id: "otros", ...o })).transaction;
  return u;
}

/** Abre el navegador (una vez por prueba) y entra con el usuario. */
export async function login(ctx, user, { width = 1280, height = 900, waitFor = "aside a[aria-current=page]" } = {}) {
  ctx.browser ??= await chromium.launch({ channel: process.env.E2E_CHANNEL ?? "chrome", headless: !process.env.E2E_HEADED });
  const page = await (await ctx.browser.newContext({ viewport: { width, height } })).newPage();
  page.on("pageerror", (e) => ctx.errors.push(e.message));
  await page.goto(BASE + "/entrar");
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 20000 });
  return page;
}
