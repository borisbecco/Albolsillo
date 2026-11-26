// Movimientos que se repiten (sumar / saltar) y categorías sin límite en el presupuesto.
import { BASE, run, newUser, login, today, prevMonth } from "./lib.mjs";

run("Recurrentes y presupuesto", async ({ check, ctx }) => {
  const u = await newUser("recur");
  const acc = await u.account("Galicia");
  await u.tx({ date: `${prevMonth}-01`, description: "Netflix", category_id: "subs", amount: "9000", recurring: true, account_id: acc.id });
  await u.tx({ date: `${prevMonth}-02`, description: "Gimnasio", category_id: "salud", amount: "25000", recurring: true, account_id: acc.id });
  await u.tx({ description: "Despegar", category_id: "viajes", amount: "300000", account_id: acc.id });

  const page = await login(ctx, u, { waitFor: "text=movimientos se repiten este mes" });
  check("aviso de recurrentes", true);
  const sec = page.locator("section[aria-label='Movimientos que se repiten']");
  await sec.locator("li", { hasText: "Netflix" }).locator("button:has-text('Sumar')").click();
  await page.waitForSelector("text=Gasto sumado: Netflix", { timeout: 8000 });
  await page.waitForTimeout(1200);
  check("queda uno", (await sec.innerText()).includes("Gimnasio") && !(await sec.innerText()).includes("Netflix"));
  await sec.locator("button:has-text('Saltar')").click();
  check("saltar lo oculta", (await sec.count()) === 0);
  await page.reload();
  await page.waitForSelector("aside a[aria-current=page]");
  await page.waitForTimeout(1200);
  check("saltado sigue oculto al recargar", (await sec.count()) === 0);
  const list = (await u.get(`/transactions?month=${today.slice(0, 7)}`)).transactions ?? [];
  const nf = list.find((t) => t.description === "Netflix" && t.date === today);
  check("Netflix cargado este mes, recurrente y en Galicia", nf?.recurring && nf.account_id === acc.id && nf.amount === "9000.00", JSON.stringify(nf));

  await page.goto(BASE + "/presupuesto");
  await page.waitForSelector("text=Viajes");
  const card = page.locator("section", { has: page.locator("strong:text-is('Viajes')") }).last();
  const ct = await card.innerText();
  check("Viajes sin límite", ct.includes("Sin límite") && !ct.includes("100%") && !ct.includes("Excedido"), ct.replace(/\n/g, " | "));
  check("sin errores", !ctx.errors.length, ctx.errors.join(" | "));
});
