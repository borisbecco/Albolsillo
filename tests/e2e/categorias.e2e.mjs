// Categorías aprendidas: al cambiar una a mano la app la recuerda para ese comercio.
// Si E2E_RESUMEN_PDF apunta a un resumen Cencosud real, también prueba la importación.
import { readFileSync } from "node:fs";
import { BASE, run, newUser, login } from "./lib.mjs";

run("Categorías aprendidas", async ({ check, ctx }) => {
  const u = await newUser("categ", {
    onboarding: {
      salary: null,
      payday: null,
      usd_income: null,
      cards: [{ name: "Cencosud Mastercard", balance: "100000.00", min_payment: "20000.00", due_day: 11, tna: "79", last4: null }],
      bills: [],
      strategy: "intereses",
    },
  });
  const card = u.onboarding.cards[0];
  const acc = await u.account("Galicia");
  const tx = (o) => u.tx({ account_id: acc.id, ...o });
  const a = await tx({ description: "MERPAGO*PANALAURITA", amount: "19200" });
  await tx({ description: "MERPAGO*PANALAURITA", amount: "29700" });
  await tx({ description: "Panalaurita", amount: "24000" });
  const varios = await tx({ description: "Varios", amount: "5000" });

  // Recategorizar uno: aprende y ofrece los demás (también el que no tiene el prefijo)
  let r = (await u.call("PATCH", `/transactions/${a.id}`, { category_id: "resto" })).body;
  check("aprende y cuenta los demás en Otros", r.similar === 2, String(r.similar));
  let rules = (await u.get("/merchant-rules")).rules;
  check("regla guardada sin el prefijo", rules.some((x) => x.merchant_key === "panalaurita" && x.category_id === "resto"), JSON.stringify(rules));
  r = await u.post("/transactions/recategorize", { transaction_id: a.id, category_id: "resto" });
  check("aplicar a los demás", r.transactions.length === 2 && r.transactions.every((t) => t.category_id === "resto"));
  await u.call("PATCH", `/transactions/${varios.id}`, { category_id: "hogar" });
  rules = (await u.get("/merchant-rules")).rules;
  check("no aprende nombres genéricos", !rules.some((x) => x.merchant_key === "varios"));

  // Importar el resumen: sugiere lo aprendido y aprende lo corregido
  if (process.env.E2E_RESUMEN_PDF) {
    const form = new FormData();
    form.append("card_id", card.id);
    form.append("file", new Blob([readFileSync(process.env.E2E_RESUMEN_PDF)], { type: "application/pdf" }), "r.pdf");
    const pv = (await u.call("POST", "/imports", form)).body;
    const pana = pv.rows.filter((x) => /PANALAURITA/.test(x.description));
    check("resumen: sugiere la categoría aprendida", pana.length > 0 && pana.every((x) => x.suggested_category === "resto" && x.learned));
    const other = pv.rows.find((x) => x.kind !== "payment" && !/PANALAURITA/.test(x.description));
    const cats = Object.fromEntries(pv.rows.map((x) => [x.row_id, x.suggested_category]));
    cats[other.row_id] = "super";
    await u.post(`/imports/${pv.import_id}/confirm`, { row_ids: pv.rows.filter((x) => x.kind !== "payment").map((x) => x.row_id), categories: cats, update_card: false });
    rules = (await u.get("/merchant-rules")).rules;
    check("resumen: aprende la categoría corregida", rules.some((x) => x.category_id === "super"));
  } else {
    console.log("(sin E2E_RESUMEN_PDF: se saltea la parte del resumen)");
  }

  // En la app: Nuevo movimiento sugiere lo aprendido y el detalle ofrece pasar los demás
  await tx({ description: "Kiosco Pepe", amount: "1000" });
  await tx({ description: "kiosco pepe", amount: "2000" });
  const page = await login(ctx, u);
  await page.waitForTimeout(800);
  await page.keyboard.press("n");
  const dlg = page.locator("[role=dialog]").last();
  await dlg.waitFor();
  await dlg.locator("input[placeholder^='Descripción']").fill("Panalaurita");
  await page.waitForTimeout(300);
  const pressed = await dlg.locator("button[aria-pressed=true]").allInnerTexts();
  check("Nuevo movimiento sugiere la categoría aprendida", pressed.some((p) => p.includes("Comida afuera")), pressed.join(" / "));
  await page.keyboard.press("Escape");
  await page.goto(BASE + "/movimientos?cat=otros");
  await page.waitForTimeout(1000);
  await page.locator("main[class*=main] button", { hasText: "Kiosco Pepe" }).first().click();
  const det = page.locator("[role=dialog]").last();
  await det.waitFor();
  await det.locator("select[aria-label=Categoría]").selectOption("resto");
  await det.locator("button").filter({ hasText: /^Guardar/ }).last().click();
  await page.waitForSelector("[role=status] button:has-text('Pasar a Comida afuera')", { timeout: 8000 });
  check("el aviso ofrece pasar los demás", (await page.locator("[role=status]").innerText()).includes("Hay 1 más"));
  await page.click("[role=status] button:has-text('Pasar a Comida afuera')");
  await page.waitForSelector("text=Listo: 1 movimiento pasó a Comida afuera", { timeout: 8000 });
  check("aplicado desde el aviso", true);
  check("sin errores", !ctx.errors.length, ctx.errors.join(" | "));
});
