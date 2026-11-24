import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { pushToUser } from "@/lib/push";
import { todayAR } from "@/lib/notify";
import { createDetected } from "./detected";
import { parseNotice, senderFor } from "./parse";

// Casilla de entrada única (Gmail por IMAP con contraseña de aplicación): cada usuario reenvía sus
// avisos a albolsillo.entrada+<código>@gmail.com. Un job cada 5 minutos lee los no leídos,
// crea los gastos detectados y borra el mail (solo se guardan los datos extraídos).

type Mail = {
  messageId?: string;
  date?: Date;
  subject?: string;
  text?: string;
  html?: string | false;
  from?: { text: string };
  to?: { text: string } | { text: string }[];
  headers: Map<string, unknown>;
};

const GMAIL_CONFIRM = /forwarding-noreply@google\.com/i;

const headerText = (v: unknown): string =>
  Array.isArray(v) ? v.map(headerText).join(" ") : v && typeof v === "object" && "text" in v ? String((v as { text: string }).text) : v ? String(v) : "";

/** Código del + en la dirección a la que llegó (Delivered-To, X-Original-To o To). */
export function addressCode(mail: Mail): string | null {
  const local = (process.env.INBOX_ADDRESS ?? "albolsillo.entrada@gmail.com").split("@")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${local}\\+([a-z0-9]{6})@`, "i");
  const where = [mail.headers.get("delivered-to"), mail.headers.get("x-original-to"), mail.headers.get("x-forwarded-to"), mail.to].map(headerText).join(" ");
  return where.match(re)?.[1]?.toLowerCase() ?? null;
}

const htmlToText = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#36;|&dollar;/g, "$")
    .replace(/[ \t]+/g, " ");

export type HandleResult = { kind: "confirmation" | "detected" | "duplicate" | "unknown_sender" | "no_amount" | "no_user"; userId?: string };

/** Procesa un mail ya parseado. */
export async function handleMail(mail: Mail): Promise<HandleResult> {
  const code = addressCode(mail);
  const source = code ? await prisma.expenseSource.findUnique({ where: { addressCode: code } }) : null;
  if (!source || source.status === "disabled") return { kind: "no_user" };
  const body = mail.text || (mail.html ? htmlToText(mail.html) : "");
  const from = mail.from?.text ?? "";

  // Confirmación de Gmail: se guarda el código para mostrarlo en la guía (no se confirma solo).
  if (GMAIL_CONFIRM.test(from)) {
    const c = body.match(/(?:c[oó]digo de confirmaci[oó]n|confirmation code)\D{0,10}(\d{6,12})/i)?.[1] ?? body.match(/\b(\d{9})\b/)?.[1] ?? null;
    const link = body.match(/https:\/\/mail(?:-settings)?\.google\.com\/mail\/[^\s"'<>]+/i)?.[0] ?? null;
    await prisma.expenseSource.update({ where: { id: source.id }, data: { confirmationCode: c, confirmationLink: link } });
    return { kind: "confirmation", userId: source.userId };
  }

  // Remitente original: From (reenvío automático), X-Forwarded-For o el bloque citado (reenvío a mano).
  const quoted = body.match(/(?:De|From)\s*:\s*[^\n]*?<?([\w.+-]+@[\w.-]+)>?/i)?.[1] ?? "";
  const sender = senderFor(`${from} ${headerText(mail.headers.get("x-forwarded-for"))} ${quoted}`);
  if (!sender) {
    const addr = (quoted || from).toLowerCase().slice(0, 200);
    if (addr) await prisma.unknownSender.upsert({ where: { sender: addr }, create: { sender: addr }, update: { count: { increment: 1 }, lastSeen: new Date() } });
    return { kind: "unknown_sender", userId: source.userId };
  }

  const parsed = parseNotice(`${mail.subject ?? ""}\n${body}`, sender, (mail.date ?? new Date()).getFullYear());
  if (!parsed) return { kind: "no_amount", userId: source.userId };
  const externalId = mail.messageId ?? createHash("sha256").update(`${from}|${mail.subject}|${body}`).digest("hex");
  const date = parsed.date ?? (mail.date ? todayAR(mail.date) : todayAR());
  const created = await createDetected(prisma, source.userId, {
    sourceId: source.id,
    origin: "mail",
    externalId,
    wallet: sender.wallet,
    merchant: parsed.merchant ?? sender.wallet,
    amount: parsed.amount,
    currency: parsed.currency,
    date,
  });
  await prisma.expenseSource.update({ where: { id: source.id }, data: { lastReceivedAt: new Date(), status: "active" } });
  return { kind: created ? "detected" : "duplicate", userId: source.userId };
}

/** Lee los mails no leídos de la casilla, los procesa, los borra y avisa por push. */
export async function runInbox() {
  const user = process.env.INBOX_USER ?? process.env.INBOX_ADDRESS;
  const pass = process.env.INBOX_APP_PASSWORD;
  if (!user || !pass) return { configured: false as const, processed: 0, detected: 0 };

  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");
  const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user, pass: pass.replace(/\s+/g, "") }, logger: false });
  const perUser = new Map<string, number>();
  let processed = 0;
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const uids = (await client.search({ seen: false }, { uid: true })) || [];
    for (const uid of uids.slice(0, 200)) {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) continue;
      try {
        const mail = (await simpleParser(msg.source)) as unknown as Mail;
        const r = await handleMail(mail);
        if (r.kind === "detected" && r.userId) perUser.set(r.userId, (perUser.get(r.userId) ?? 0) + 1);
      } catch (e) {
        console.warn("[inbox] no se pudo procesar un mail", e);
      }
      processed++;
      // Se borra siempre: no guardamos los mails (ver Términos y privacidad).
      await client.messageDelete(String(uid), { uid: true }).catch(() => {});
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }

  for (const [userId, n] of perUser) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { pushEnabled: true } });
    if (u?.pushEnabled) {
      await pushToUser(userId, {
        title: "Albolsillo",
        body: n === 1 ? "Detectamos 1 gasto nuevo. Revisalo antes de sumarlo." : `Detectamos ${n} gastos nuevos. Revisalos antes de sumarlos.`,
        url: "/?ver=detectados",
      }).catch(() => {});
    }
  }
  return { configured: true as const, processed, detected: [...perUser.values()].reduce((a, b) => a + b, 0) };
}
