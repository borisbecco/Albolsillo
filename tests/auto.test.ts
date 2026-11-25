import { test } from "node:test";
import assert from "node:assert/strict";
import { GMAIL_FILTER, parseArNumber, parseNotice, senderFor, walletFromText } from "@/lib/auto/parse";
import { addressCode, gmailConfirmation } from "@/lib/auto/inbox";

test("parseArNumber", () => {
  assert.equal(parseArNumber("18.450"), 18450);
  assert.equal(parseArNumber("3.500,00"), 3500);
  assert.equal(parseArNumber("1,234.56"), 1234.56);
  assert.equal(parseArNumber("99.90"), 99.9);
});

test("lee monto y comercio de un aviso de Mercado Pago", () => {
  const p = parseNotice("¡Listo! Pagaste $ 18.450 a Rappi con tu dinero en cuenta.", senderFor("info@mercadopago.com"), 2026);
  assert.equal(p?.amount, 18450);
  assert.equal(p?.currency, "ARS");
  assert.equal(p?.merchant, "Rappi");
});

test("no toma 'fue aprobado' como parte del comercio", () => {
  const p = parseNotice("Tu pago de $ 5.000 a Netflix fue aprobado", null, 2026);
  assert.equal(p?.merchant, "Netflix");
});

test("dólares y fecha", () => {
  const p = parseNotice("Compraste US$ 12,99 en Steam el 24/11/2026", null, 2026);
  assert.equal(p?.currency, "USD");
  assert.equal(p?.amount, 12.99);
  assert.equal(p?.date, "2026-11-24");
});

test("sin monto no hay gasto", () => {
  assert.equal(parseNotice("Tenés una nueva promoción", null, 2026), null);
});

test("reconoce remitentes reales, también con subdominios", () => {
  assert.equal(senderFor("Mercado Pago <info@mercadopago.com>")?.wallet, "Mercado Pago");
  assert.equal(senderFor("avisos@mails.bancogalicia.com.ar")?.wallet, "Galicia");
  assert.equal(senderFor("alertas@bna.com.ar")?.wallet, "Banco Nación");
  assert.equal(senderFor("resumen@tarjetacencosud.com.ar")?.wallet, "Cencosud");
  assert.equal(senderFor("amigo@gmail.com"), null);
  assert.equal(senderFor("promos@tapcolor.com"), null);
});

test("billetera de un comprobante: sin confundir palabras comunes", () => {
  assert.equal(walletFromText("Comprobante de pago Mercado Pago con Visa")?.wallet, "Mercado Pago");
  assert.equal(walletFromText("Pagaste con MODO")?.wallet, "MODO");
  assert.equal(walletFromText("de este modo te informamos"), null);
});

test("el filtro de Gmail va por palabra (Mercado Pago escribe desde .com)", () => {
  assert.match(GMAIL_FILTER, /^from:\(mercadopago OR /);
  assert.ok(!GMAIL_FILTER.includes("mercadopago.com.ar"));
  assert.ok(GMAIL_FILTER.length < 1500, `largo ${GMAIL_FILTER.length}`);
});

test("código de la dirección de reenvío, sin importar puntos ni mayúsculas", () => {
  process.env.INBOX_ADDRESS = "albolsillo.entrada@gmail.com";
  const mk = (dt: string) => ({ headers: new Map([["delivered-to", dt]]), to: undefined }) as never;
  assert.equal(addressCode(mk("albolsillo.entrada+g738dp@gmail.com")), "g738dp");
  assert.equal(addressCode(mk("albolsilloentrada+G738DP@gmail.com")), "g738dp");
  assert.equal(addressCode(mk("otro+g738dp@gmail.com")), null);
});

test("código de confirmación de Gmail: del asunto o del cuerpo", () => {
  assert.equal(gmailConfirmation("(#584209731) Confirmación de reenvío de Gmail", "").code, "584209731");
  assert.equal(gmailConfirmation("Confirmación", "Código de confirmación: 584209731").code, "584209731");
  const r = gmailConfirmation("Confirmación", "Para permitir: https://mail-settings.google.com/mail/vf-123456789123-x");
  assert.equal(r.code, null);
  assert.ok(r.link?.startsWith("https://mail-settings.google.com/mail/vf-"));
});
