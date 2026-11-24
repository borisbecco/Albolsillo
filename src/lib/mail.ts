import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

// Mails transaccionales con Resend. Sin RESEND_API_KEY (desarrollo) se escriben en la consola.

const TEMPLATES = path.join(process.cwd(), "src", "emails");

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function send(to: string, subject: string, html: string, devNote: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[mail] (sin RESEND_API_KEY) Para: ${to} · ${subject}\n${devNote}`);
    return;
  }
  const { error } = await new Resend(key).emails.send({
    from: process.env.MAIL_FROM ?? "Albolsillo <hola@albolsillo.app>",
    replyTo: "ayuda@albolsillo.app",
    to,
    subject,
    html,
  });
  if (error) console.error("[mail] error al enviar", error);
}

function describeAgent(ua: string | null) {
  if (!ua) return "un navegador";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "un navegador";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  return os ? `${browser} en ${os}` : browser;
}

export async function sendPasswordReset(to: string, token: string, userAgent: string | null) {
  const link = `${appUrl()}/reset/${token}`;
  const when = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const html = (await readFile(path.join(TEMPLATES, "recuperar-contrasena.html"), "utf8"))
    .replaceAll("https://albolsillo.app/reset/XYZ789", link)
    .replace("Pedido desde Chrome en Windows · Buenos Aires, Argentina · 20 nov 2026, 14:32", `Pedido desde ${describeAgent(userAgent)} · ${when}`);

  await send(to, "Cambiá tu contraseña de Albolsillo", html, `Link: ${link}`);
}
