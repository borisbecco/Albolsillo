// Carga automática (API): mails reenviados, gastos detectados, categorías aprendidas y comprobantes.
// Usa /dev/inbound-mail, que solo existe con INBOX_DEV_ENDPOINT=1.
import PDFDocument from "pdfkit";
import { run, newUser, today } from "./lib.mjs";

let n = 0;
const mail = (to, from, subject, body, id) =>
  [
    `Delivered-To: ${to}`,
    `From: ${from}`,
    "To: yo@gmail.com",
    `Subject: ${subject}`,
    `Message-ID: <${id ?? `m${Date.now()}${n++}`}@test>`,
    `Date: ${new Date().toUTCString()}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

const pdf = (lines) =>
  new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    lines.forEach((l) => doc.text(l));
    doc.end();
  });

const MP = "Mercado Pago <info@mercadopago.com>";

run("Carga automática", async ({ check }) => {
  const u = await newUser("auto");
  const inbound = async (raw) => (await u.call("POST", "/dev/inbound-mail", raw)).body;
  // Cada mail usa un Message-ID propio para no chocar con otras corridas
  const tag = Date.now();
  const mp = await u.account("Mercado Pago", "billetera", "200000");
  await u.account("Galicia", "banco", "100000");

  let r = await u.call("POST", "/sources/forward");
  const addr = r.body.address;
  check("dirección de reenvío", r.status === 201 && /^albolsillo\.entrada\+[a-z0-9]{6}@gmail\.com$/.test(addr), addr);
  check("misma dirección si ya existe", (await u.post("/sources/forward")).address === addr);

  r = await inbound(mail(addr, "Gmail Team <forwarding-noreply@google.com>", "(#584209731) Confirmación de reenvío de Gmail", "Código de confirmación: 584209731\nPara permitir: https://mail-settings.google.com/mail/vf-abc123"));
  check("procesa la confirmación de Gmail", r?.kind === "confirmation", JSON.stringify(r));
  r = await u.get("/sources/forward/confirmation");
  check("muestra el código de Gmail", r.code === "584209731" && r.link.startsWith("https://mail-settings.google.com"), JSON.stringify(r));

  r = await inbound(mail(addr, MP, "Pagaste a Rappi", "¡Listo! Pagaste $ 18.450 a Rappi con tu dinero en cuenta.", `rappi1-${tag}`));
  check("crea gasto detectado", r?.kind === "detected", JSON.stringify(r));
  const d = (await u.get("/detected")).detected.find((x) => x.merchant === "Rappi");
  check("lee monto, comercio y billetera", d?.amount === "18450.00" && d.wallet === "Mercado Pago" && d.currency === "ARS", JSON.stringify(d));
  check("categoría sugerida", d?.category_id === "resto");
  check("cuenta sugerida por billetera", d?.account_id === mp.id);
  check("mismo mail no se repite", (await inbound(mail(addr, MP, "Pagaste a Rappi", "Pagaste $ 18.450 a Rappi", `rappi1-${tag}`)))?.kind === "duplicate");
  check("remitente desconocido se descarta", (await inbound(mail(addr, "Tienda <ventas@tiendita.com>", "Tu compra", "Compraste $ 5.000 en Tiendita")))?.kind === "unknown_sender");
  check("código inexistente se descarta", (await inbound(mail("albolsillo.entrada+zzzzzz@gmail.com", MP, "x", "Pagaste $ 1.000 a X")))?.kind === "no_user");

  await u.tx({ description: "Coto", category_id: "super", amount: "25000", account_id: mp.id });
  await inbound(mail(addr, MP, "Pagaste en Coto", "Pagaste $ 25.000 en Coto", `coto1-${tag}`));
  const coto = (await u.get("/detected")).detected.find((x) => x.merchant === "Coto");
  check("marca posible duplicado", !!coto?.possible_duplicate_of, JSON.stringify(coto));

  const balance = async () => Number((await u.get("/accounts")).accounts.find((a) => a.id === mp.id).balance);
  const before = await balance();
  r = await u.call("POST", "/detected/confirm", { ids: [d.id], learn: [{ id: d.id, category_id: "ocio" }], edits: { [d.id]: { category_id: "ocio" } } });
  const t0 = r.body.transactions?.[0];
  check("confirmar crea el movimiento", r.status === 200 && r.body.transactions.length === 1 && t0.source === "mail" && t0.category_id === "ocio", JSON.stringify(r.body).slice(0, 300));
  check("aprende la categoría", r.body.learned === 1);
  check("descuenta de la cuenta", before - (await balance()) === 18450);
  check("regla guardada", (await u.get("/merchant-rules")).rules.some((x) => x.merchant_label === "Rappi" && x.category_id === "ocio"));
  await inbound(mail(addr, MP, "Pagaste a Rappi", "Pagaste $ 9.900 a Rappi", `rappi2-${tag}`));
  const rappi2 = (await u.get("/detected")).detected.find((x) => x.merchant === "Rappi");
  check("usa la categoría aprendida", rappi2?.category_id === "ocio" && rappi2.learned === true, JSON.stringify(rappi2));

  check("descartar", (await u.call("POST", `/detected/${coto.id}/discard`)).status === 204);
  check("descartado no vuelve", (await inbound(mail(addr, MP, "Pagaste en Coto", "Pagaste $ 25.000 en Coto", `coto1-${tag}`)))?.kind === "duplicate");

  const file = await pdf(["Mercado Pago", "Comprobante de pago", `Fecha: ${today.split("-").reverse().join("/")}`, `Pagaste a Kiosco ${tag}`, "Monto: $ 3.500,00"]);
  const form = new FormData();
  form.append("file", new Blob([file], { type: "application/pdf" }), "comprobante.pdf");
  r = await u.call("POST", "/detected/share", form);
  check("lee comprobante PDF", r.status === 201 && r.body.detected.amount === "3500.00" && r.body.detected.origin === "share", JSON.stringify(r.body));
  check("mismo archivo no se repite", (await u.call("POST", "/detected/share", form)).status === 409);

  r = await u.get("/me/bootstrap");
  check("bootstrap trae la bandeja", r.detected?.length === 2, String(r.detected?.length));
  const rule = (await u.get("/merchant-rules")).rules[0];
  check("olvidar regla", (await u.call("DELETE", `/merchant-rules/${rule.id}`)).status === 204);
  const src = (await u.get("/sources")).sources[0];
  await u.call("DELETE", `/sources/${src.id}`);
  check("dirección desactivada descarta", (await inbound(mail(addr, MP, "x", "Pagaste $ 2.000 a Y")))?.kind === "no_user");
  check("lista de espera de Android", (await u.post("/sources/notify-android", { on: true })).android_waitlist === true);
});
