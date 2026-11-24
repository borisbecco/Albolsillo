import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

// Mails transaccionales con Resend. Sin RESEND_API_KEY (desarrollo) se escriben en la consola.

const TEMPLATES = path.join(process.cwd(), "src", "emails");

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function send(to: string, subject: string, rawHtml: string, devNote: string) {
  // El logo de las plantillas apunta a un CDN de ejemplo: se sirve desde la app (PNG de 300 px, @2x).
  const html = rawHtml.replaceAll("https://cdn.albolsillo.app/brand/albolsillo-logo-horizontal-fondo-claro.png", `${appUrl()}/brand/logo-mail.png`);
  // Desarrollo: con MAIL_DUMP_DIR, cada mail se guarda también como HTML para revisarlo.
  if (process.env.MAIL_DUMP_DIR) {
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(process.env.MAIL_DUMP_DIR, { recursive: true });
    await writeFile(path.join(process.env.MAIL_DUMP_DIR, `${Date.now()}-${subject.replace(/[^\w]+/g, "_").slice(0, 60)}.html`), html);
  }
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

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "jueves 23" para un día del mes actual (en Argentina). */
function weekdayLabel(today: string, day: number) {
  const d = new Date(`${today.slice(0, 8)}${String(day).padStart(2, "0")}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${day}`;
}
const inDays = (n: number) => (n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`);

/** Reemplaza las filas de ejemplo de una tabla (la que sigue a `marker`) por filas generadas. Sin filas, quita la sección. */
function fillRows(html: string, marker: string, rows: { title: string; sub: string; right: string; rightColor?: string }[]) {
  const p = html.indexOf(marker);
  if (p < 0) return html;
  const pStart = html.lastIndexOf("<p", p);
  const tStart = html.indexOf("<table", p);
  const tEnd = html.indexOf("</table>", tStart) + "</table>".length;
  if (!rows.length) return html.slice(0, pStart) + html.slice(tEnd);
  const table = html.slice(tStart, tEnd);
  const sample = table.slice(table.indexOf("<tr>"), table.indexOf("</tr>") + 5);
  const built = rows
    .map((r) => {
      let tr = sample.replace(/(<span class="ink">)[^<]*(<\/span>)/, `$1${esc(r.title)}$2`).replace(/(<span class="mut"[^>]*>)[^<]*(<\/span>)/, `$1${esc(r.sub)}$2`);
      // Monto de la derecha: el último <span> de la fila.
      const last = tr.lastIndexOf("<span");
      const close = tr.indexOf("</span>", last);
      const open = tr.indexOf(">", last) + 1;
      let spanTag = tr.slice(last, open);
      if (r.rightColor) spanTag = spanTag.replace(/color:#[0-9A-Fa-f]{6}/, `color:${r.rightColor}`);
      tr = tr.slice(0, last) + spanTag + esc(r.right) + tr.slice(close);
      return tr;
    })
    .join("");
  const head = table.slice(0, table.indexOf("<tr>"));
  return html.slice(0, tStart) + head + built + "</table>" + html.slice(tEnd);
}

/** Mail "aviso-vencimiento": una tarjeta o un gasto fijo que vence pronto. */
export async function sendDueNotice(
  to: string,
  today: string,
  item: { kind: "card" | "bill"; name: string; day: number; daysLeft: number; amount: number; min?: number; suggested?: number; suggestedTag?: string },
  strategyLabel: string,
  alertDays: number,
) {
  const when = weekdayLabel(today, item.day);
  const subject = `Tu ${item.name} vence ${inDays(item.daysLeft)}`;
  const isCard = item.kind === "card";
  const full = isCard && item.suggested !== undefined && item.suggested >= item.amount - 0.5;
  let html = await readFile(path.join(TEMPLATES, "aviso-vencimiento.html"), "utf8");
  html = html
    .replaceAll("Tu Visa Galicia vence en 3 días", esc(subject))
    .replaceAll("Tu Visa Galicia vence el jueves 23", `Tu ${esc(item.name)} vence el ${when}`)
    .replaceAll(
      "Pagá al menos $ 98.400 antes del jueves 23 para evitar intereses.",
      isCard ? `Pagá al menos ${money(item.min ?? 0)} antes del ${when} para no entrar en mora.` : `Pagá ${money(item.amount)} antes del ${when}.`,
    )
    .replaceAll("Vence en 3 días", item.daysLeft === 0 ? "Vence hoy" : item.daysLeft === 1 ? "Vence mañana" : `Vence en ${item.daysLeft} días`)
    .replaceAll(
      "Según tu plan de pagos, te conviene cancelar el total para no pagar intereses este mes.",
      isCard
        ? full
          ? "Según tu plan de pagos, te conviene cancelar el total para no pagar intereses este mes."
          : `Según tu plan de pagos, este mes te conviene pagar ${money(item.suggested ?? item.min ?? 0)} (${(item.suggestedTag ?? "mínimo").toLowerCase()}).`
        : "Es un gasto fijo del mes. Cuando lo pagues, marcalo en la app.",
    )
    .replace("Saldo total", isCard ? "Saldo total" : "Monto")
    .replace("$ 486.200", money(item.amount))
    .replace("Pago mínimo", isCard ? "Pago mínimo" : "Vence")
    .replace("$ 98.400", isCard ? money(item.min ?? 0) : `el ${when}`)
    .replace("Sugerido por tu plan", isCard ? "Sugerido por tu plan" : "A pagar")
    .replace("Estrategia: evitar intereses", isCard ? `Estrategia: ${esc(strategyLabel.toLowerCase())}` : "Gasto fijo")
    .replace("$ 486.200", money(isCard ? (item.suggested ?? item.min ?? item.amount) : item.amount))
    .replaceAll("Te avisamos 3 días antes", `Te avisamos ${alertDays} ${alertDays === 1 ? "día" : "días"} antes`)
    .replaceAll("https://albolsillo.app/plan", `${appUrl()}/plan`)
    .replaceAll("https://albolsillo.app/configuracion/avisos", `${appUrl()}/`)
    .replaceAll("https://albolsillo.app/ayuda", "mailto:ayuda@albolsillo.app");
  await send(to, subject, html, `${subject} · ${money(item.amount)}`);
}

/** Mail "resumen-diario": gasto de ayer, disponible del mes, próximos vencimientos y alertas. */
export async function sendDailySummary(opts: {
  to: string;
  name: string;
  today: string;
  spentYesterday: number;
  available: number;
  due: { name: string; day: number; daysLeft: number; amount: number; min?: number; kind: "card" | "bill" }[];
  budgetAlerts: { name: string; spent: number; limit: number }[];
  unsubscribeUrl: string;
}) {
  const [, m, d] = opts.today.split("-").map(Number);
  const dateLong = (() => {
    const w = new Date(`${opts.today}T12:00:00Z`).getUTCDay();
    const s = `${WEEKDAYS[w]} ${d} de ${MONTHS[m - 1]}`;
    return s[0].toUpperCase() + s.slice(1);
  })();
  const first = esc(opts.name.split(" ")[0] || opts.name);
  const subject = `Tu resumen de hoy · ${d} ${MONTHS[m - 1].slice(0, 3)}`;
  const next = opts.due[0];
  const over = opts.budgetAlerts.find((b) => b.spent >= b.limit);
  const pre = [
    opts.spentYesterday ? `Gastaste ${money(opts.spentYesterday)} ayer.` : "Ayer no cargaste gastos.",
    next ? `${next.daysLeft === 0 ? "Hoy" : next.daysLeft === 1 ? "Mañana" : `En ${next.daysLeft} días`} vence ${next.name}` : "",
    over ? `${next ? " y te" : "Te"} pasaste en ${over.name.toLowerCase()}.` : next ? "." : "",
  ].join(" ");

  let html = await readFile(path.join(TEMPLATES, "resumen-diario.html"), "utf8");
  html = html
    .replaceAll("Tu resumen de hoy · 20 nov", esc(subject))
    .replaceAll("Gastaste $ 42.300 ayer. Mañana vence Edenor y te pasaste en ropa.", esc(pre.replace(/\s+/g, " ").trim()))
    .replaceAll("Jueves 20 de noviembre", esc(dateLong))
    .replaceAll("Buen día, Lucía", `Buen día, ${first}`)
    .replace("$ 42.300", money(opts.spentYesterday))
    .replace("$ 1.284.900", `${opts.available < 0 ? "-" : ""}${money(opts.available)}`);

  html = fillRows(
    html,
    "Próximos vencimientos",
    opts.due.map((x) => {
      const when = weekdayLabel(opts.today, x.day);
      const label = x.daysLeft === 0 ? `Hoy · ${when}` : x.daysLeft === 1 ? `Mañana · ${when}` : when[0].toUpperCase() + when.slice(1);
      return { title: x.name, sub: x.kind === "card" && x.min ? `${label} · mínimo ${money(x.min)}` : label, right: money(x.amount) };
    }),
  );
  html = fillRows(
    html,
    "Alertas</p>",
    opts.budgetAlerts.map((b) => {
      const pct = Math.round((b.spent / b.limit) * 100);
      return b.spent >= b.limit
        ? { title: `Te pasaste en ${b.name}`, sub: `${money(b.spent)} de ${money(b.limit)}`, right: `${pct}%`, rightColor: "#C2414F" }
        : { title: `${b.name} al ${pct}%`, sub: `Te quedan ${money(b.limit - b.spent)} hasta fin de mes`, right: `${pct}%`, rightColor: "#B7791F" };
    }),
  );
  html = html
    .replaceAll("https://albolsillo.app/baja?t=abc", opts.unsubscribeUrl)
    .replaceAll("https://albolsillo.app/configuracion/avisos", `${appUrl()}/`)
    .replaceAll("https://albolsillo.app/ayuda", "mailto:ayuda@albolsillo.app")
    .replaceAll('href="https://albolsillo.app"', `href="${appUrl()}"`);
  await send(opts.to, subject, html, `${subject}\n${pre}`);
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
