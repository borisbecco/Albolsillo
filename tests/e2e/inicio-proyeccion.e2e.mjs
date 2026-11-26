// Inicio (proyección, estado del resumen, duplicados) y la vista Proyección con el simulador.
import { BASE, run, newUser, login, day, dayOfMonth, prevMonth } from "./lib.mjs";

run("Inicio y Proyección", async ({ check, ctx }) => {
  const u = await newUser("inicio", {
    onboarding: {
      salary: "2400000.00",
      payday: 1,
      usd_income: null,
      cards: [{ name: "Cencosud Mastercard", balance: "2266857.00", min_payment: "685760.00", due_day: 11, tna: "79", last4: "3877" }],
      bills: [{ name: "Alquiler", amount: "450000.00", currency: "ARS", due_day: 28, category_id: "alquiler" }],
      strategy: "avalancha",
    },
  });
  const card = u.onboarding.cards[0];
  const acc = await u.account("Galicia", "banco", "3000000");
  const tx = (o) => u.tx({ account_id: acc.id, ...o });
  await tx({ type: "in", date: day(1), description: "Sueldo", category_id: "sueldo", amount: "2400000" });
  for (const [dd, desc, cat, amt] of [[3, "Coto", "super", 48300], [7, "Rappi", "resto", 35377], [12, "DiDi", "transp", 18600], [15, "Varios", "otros", 300000]])
    await tx({ date: day(dd), description: desc, category_id: cat, amount: String(amt) });
  // Duplicado: mismo día, descripción, monto y moneda
  await tx({ date: day(dayOfMonth), description: "Kiosco", amount: "1500" });
  await tx({ date: day(dayOfMonth), description: "kiosco", amount: "1500" });
  for (const [dd, desc, cat, amt] of [[1, "Sueldo", "sueldo", 2300000], [4, "Coto", "super", 52000], [10, "Rappi", "resto", 41000], [16, "Varios", "otros", 380000]])
    await tx({ type: cat === "sueldo" ? "in" : "out", date: `${prevMonth}-${String(dd).padStart(2, "0")}`, description: desc, category_id: cat, amount: String(amt) });
  await u.tx({ date: day(10), description: "Heladera", category_id: "hogar", amount: "300000", account_id: null, card_id: card.id, installments: 3 });
  await u.post(`/cards/${card.id}/payments`, { amount: "700000", currency: "ARS", account_id: acc.id });

  const page = await login(ctx, u, { width: 1440, waitFor: "text=Mis números" });
  await page.waitForTimeout(1000);
  const main = () => page.locator("main[class*=main]").innerText();
  let t = await main();
  check("pastilla de proyección", /Si seguís así, terminás el mes gastando/.test(t) && /(te quedarían|más que tus ingresos)/.test(t));
  check("eje con Hoy", /Hoy · \d+/.test(t));
  check(
    "estado del resumen",
    /Pagaste\s*\$ 700\.000\s*de\s*\$ 2\.266\.857/.test(t) && /Mínimo \$ 685\.760/.test(t) && /Falta \$ 1\.566\.857/.test(t),
    (t.match(/Pagaste[\s\S]{0,60}/) || [""])[0].replace(/\n/g, " "),
  );
  check(
    "una tarjeta: Registrar pago al lado y sin flechas",
    (await page.locator("button:has-text('Registrar pago')").count()) >= 1 && (await page.locator("button[title='Tarjeta siguiente']").count()) === 0,
  );
  check("Mis números con Próximo vencimiento", t.includes("Próximo vencimiento") && !t.includes("A pagar en tarjetas"));
  check("Qué pagar este mes", t.includes("Qué pagar este mes"));
  const dups = page.locator("button:has-text('¿Duplicado? Eliminar')");
  check("posible duplicado marcado (uno solo)", (await dups.count()) === 1, String(await dups.count()));
  await dups.first().click();
  await page.waitForSelector("[role=status] button:has-text('Deshacer')", { timeout: 6000 });
  await page.waitForTimeout(800);
  check("eliminado con Deshacer", (await page.locator("button:has-text('¿Duplicado? Eliminar')").count()) === 0);

  // Proyección
  await page.goto(BASE + "/proyeccion");
  await page.waitForSelector("text=¿Me lo puedo permitir?");
  check("vista Proyección en Planificar", (await page.locator("main[class*=main] nav a[aria-current=page]").innerText()).includes("Proyección"));
  await page.getByLabel("Importe").fill("300000");
  await page.getByPlaceholder("Ej. Lavarropas").fill("Lavarropas");
  await page.locator("[role=group][aria-label=Cuotas] button:text-is('6')").click();
  await page.waitForTimeout(400);
  t = await main();
  check("cuota mensual", t.includes("$ 50.000"), (t.match(/Cuota mensual\s*\S+ \S+/) || [""])[0]);
  check("veredicto", /(Te alcanza|Entra, pero justo|No te alcanza|Primero ordená tus cuentas)/.test(t));
  check("12 barras", (await page.locator("[class*=bars] > button").count()) === 12);
  await page.locator("[class*=bars] > button").nth(2).click();
  t = await main();
  check("detalle de un mes futuro", t.includes("Ingresos estimados") && t.includes("Esta compra (cuota 3/6)"));
  await page.click("button:has-text('La hice: cargar la compra')");
  const dlg = page.locator("[role=dialog]").last();
  await dlg.waitFor();
  const vals = await dlg.locator("input").evaluateAll((els) => els.map((e) => e.value));
  const pressed = await dlg.locator("button[aria-pressed=true]").allInnerTexts();
  check(
    "Nuevo movimiento precargado",
    vals.includes("300.000") && vals.includes("Lavarropas") && pressed.some((p) => p.includes("Cencosud")),
    JSON.stringify({ vals, pressed }),
  );
  await page.keyboard.press("Escape");

  // Celular
  const mob = await login(ctx, u, { width: 390, height: 844, waitFor: "text=Mis números" });
  await mob.goto(BASE + "/proyeccion");
  await mob.waitForSelector("text=¿Me lo puedo permitir?");
  check("Proyección abre en el celular", true);
  check("sin errores", !ctx.errors.length, ctx.errors.join(" | "));
});
