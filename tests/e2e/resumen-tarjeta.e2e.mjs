// Cargar el resumen nuevo de una tarjeta y deshacerlo (por la API y desde la pantalla).
import { BASE, run, newUser, login } from "./lib.mjs";

const VISA = {
  salary: null,
  payday: null,
  usd_income: null,
  cards: [{ name: "Visa Galicia", balance: "100000.00", min_payment: "20000.00", due_day: 10, tna: "80", last4: null }],
  bills: [],
  strategy: "intereses",
};

run("Resumen de tarjeta", async ({ check, ctx }) => {
  // API: el resumen suma la cuota siguiente y deshacer deja todo como estaba
  const u = await newUser("resum", { onboarding: VISA });
  const card = u.onboarding.cards[0];
  const acc = await u.account("Galicia");
  const buy = await u.tx({ description: "Heladera", category_id: "hogar", amount: "300000", account_id: null, card_id: card.id, installments: 3 });
  check("compra en 3 cuotas", !!buy?.id);
  await u.post(`/cards/${card.id}/payments`, { amount: "40000", currency: "ARS", account_id: acc.id });
  const before = await u.get("/me/bootstrap");
  const cBefore = before.cards.find((c) => c.id === card.id);
  const qBefore = before.installments.find((q) => q.card_id === card.id);
  const stmt = { balance: "180000", balance_usd: "0", minimum: "36000", close_day: 28, due_day: 12 };
  const st = await u.call("POST", `/cards/${card.id}/statements`, stmt);
  check("resumen cargado con token", st.status === 200 && !!st.body.undo_token && st.body.transactions.length === 1);
  check("ciclo nuevo", st.body.card.balance === "180000.00" && st.body.card.cycle_paid === "0.00" && st.body.installments[0].n === 2);
  const un = await u.call("POST", `/cards/${card.id}/statements/undo`, { undo_token: st.body.undo_token });
  check("deshacer", un.status === 200, JSON.stringify(un.body).slice(0, 200));
  const after = await u.get("/me/bootstrap");
  const cAfter = after.cards.find((c) => c.id === card.id);
  check("tarjeta como antes", ["balance", "min_payment", "close_day", "due_day", "cycle_paid", "cycle_start"].every((k) => cAfter[k] === cBefore[k]));
  check("cuota vuelve a la anterior", after.installments.find((q) => q.card_id === card.id).n === qBefore.n);
  check("se borró la cuota sumada", !after.transactions.some((t) => t.id === st.body.transactions[0].id));
  check("no se deshace dos veces", (await u.call("POST", `/cards/${card.id}/statements/undo`, { undo_token: st.body.undo_token })).status === 422);
  const st2 = await u.call("POST", `/cards/${card.id}/statements`, stmt);
  await u.call("POST", `/cards/${card.id}/statements`, { ...stmt, balance: "90000", minimum: "18000" });
  check("no se deshace uno viejo si hay otro después", (await u.call("POST", `/cards/${card.id}/statements/undo`, { undo_token: st2.body.undo_token })).status === 422);

  // Pantalla: cargar y deshacer desde el aviso
  const v = await newUser("resum", { onboarding: VISA });
  const page = await login(ctx, v);
  await page.goto(BASE + "/deudas");
  await page.click("main:visible button:has-text('Cargar resumen nuevo')");
  const dlg = page.locator("[role=dialog]").last();
  await dlg.waitFor();
  await dlg.locator("input").nth(0).pressSequentially("250.000");
  await dlg.locator("input").nth(1).pressSequentially("50.000").catch(() => {});
  await dlg.locator("button").filter({ hasText: /Cargar|Guardar/ }).last().click();
  await page.waitForSelector("text=Resumen de Visa Galicia cargado", { timeout: 8000 });
  check("aviso con Deshacer", (await page.locator("[role=status] button:has-text('Deshacer')").count()) === 1);
  check("saldo nuevo en pantalla", (await page.locator("main").innerText()).includes("250.000"));
  await page.click("[role=status] button:has-text('Deshacer')");
  await page.waitForSelector("text=Listo, volvimos al resumen anterior", { timeout: 8000 });
  await page.waitForTimeout(500);
  const t = await page.locator("main").innerText();
  check("vuelve el saldo anterior", t.includes("100.000") && !t.includes("250.000"));
  check("sin errores", !ctx.errors.length, ctx.errors.join(" | "));
});
