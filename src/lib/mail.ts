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

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n: number) => `$ ${Math.round(Math.abs(n)).toLocaleString("es-AR")}`;

export type InviteRow = { description: string; payer: string; among: number; dateLabel: string; share: number };

/**
 * Mail "invitacion": quién invita, los últimos gastos compartidos (la parte del invitado) y el saldo.
 * `balance` es desde el lado del invitado: > 0 le debe a quien invita, < 0 quien invita le debe.
 */
export async function sendInvite(opts: {
  to: string;
  inviterName: string;
  inviterEmail: string;
  token: string;
  rows: InviteRow[];
  balance: number;
}) {
  const first = esc(opts.inviterName.split(" ")[0] || opts.inviterName);
  const full = esc(opts.inviterName);
  const link = `${appUrl()}/invitacion/${opts.token}`;
  let html = await readFile(path.join(TEMPLATES, "invitacion.html"), "utf8");

  // Filas de gastos: se reemplazan las dos de ejemplo por las reales (o se quitan si no hay).
  const start = html.indexOf('<tr><td class="line"');
  const end = html.indexOf('<tr><td style="padding:14px 0 0 0');
  if (start > 0 && end > start) {
    const sample = html.slice(start, html.indexOf("</tr>", start) + 5);
    const rows = opts.rows
      .slice(0, 4)
      .map((r) =>
        sample
          .replace("Asado del sábado", esc(r.description))
          .replace("Pagó Lucía · entre 4 · 15 nov", `Pagó ${esc(r.payer)} · entre ${r.among} · ${esc(r.dateLabel)}`)
          .replace("$ 12.000", money(r.share)),
      )
      .join("");
    html = html.slice(0, start) + rows + html.slice(end);
  }

  // Saldo final.
  const owes = opts.balance >= 1;
  const owed = opts.balance <= -1;
  html = html
    .replace(`Le debés a Lucía</td>`, owes ? `Le debés a ${first}</td>` : owed ? `${first} te debe</td>` : `Están a mano</td>`)
    .replace(`color:#C2414F">$ 18.500</td>`, owes ? `color:#C2414F">${money(opts.balance)}</td>` : owed ? `color:#1F8A5B">${money(opts.balance)}</td>` : `color:#525A6B">$ 0</td>`)
    .replace(`Le debés $ 18.500.`, owes ? `Le debés ${money(opts.balance)}.` : owed ? `Te debe ${money(opts.balance)}.` : "");

  html = html
    .replaceAll("https://albolsillo.app/invitacion/ABC123", link)
    .replaceAll("Lucía Fernández (lucia@email.com)", `${full} (${esc(opts.inviterEmail)})`)
    .replaceAll("Lucía Fernández", full)
    .replaceAll("Lucía", first);

  await send(opts.to, `${opts.inviterName.split(" ")[0]} te invitó a dividir gastos en Albolsillo`, html, `Link: ${link}`);
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
