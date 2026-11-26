// Contactos, metas de ahorro y transferencias entre cuentas, desde la pantalla.
import { BASE, run, newUser, login } from "./lib.mjs";

run("Compartidos, metas y cuentas", async ({ check, ctx }) => {
  const u = await newUser("slice");
  await u.account("Galicia", "banco", "500000");
  await u.account("Mercado Pago", "billetera", "10000");
  const page = await login(ctx, u);

  await page.goto(BASE + "/compartidos");
  await page.click("button:has-text('Agregar contacto')");
  await page.getByPlaceholder(/nombre/i).first().fill("Ana");
  await page.locator("form button[type=submit]").first().click();
  await page.waitForSelector("text=Agregamos a Ana", { timeout: 8000 }).catch(() => {});
  const people = (await u.get("/me/bootstrap")).people;
  check("compartidos: agregar contacto", people.some((p) => p.name === "Ana"), JSON.stringify(people.map((p) => p.name)));
  check("compartidos: aparece en pantalla", (await page.locator("text=Ana").count()) > 0);

  await page.goto(BASE + "/metas");
  await page.waitForTimeout(1000);
  if ((await page.getByLabel("Nombre de la meta").count()) === 0) await page.locator("button:has-text('Crear meta')").first().click();
  await page.getByLabel("Nombre de la meta").fill("Vacaciones");
  await page.getByLabel("Monto objetivo").fill("300.000");
  await page.locator("form button[type=submit]:has-text('Crear meta')").click();
  await page.waitForTimeout(1500);
  const goals = (await u.get("/me/bootstrap")).goals;
  check("metas: crear meta", goals.some((g) => g.name === "Vacaciones"), JSON.stringify(goals.map((g) => g.name)));

  await page.goto(BASE + "/cuentas");
  await page.waitForTimeout(1000);
  const form = page.locator("form", { hasText: "Transferir entre cuentas" });
  await form.locator("input[placeholder='0']").first().fill("5.000");
  await Promise.all([page.waitForResponse((r) => r.url().includes("/transfers")), form.locator("button[type=submit]").click()]);
  await page.waitForTimeout(500);
  const accs = (await u.get("/me/bootstrap")).accounts;
  const bal = (n) => accs.find((a) => a.name === n)?.balance;
  check("cuentas: transferencia", bal("Galicia") === "495000.00" && bal("Mercado Pago") === "15000.00", JSON.stringify(accs.map((a) => [a.name, a.balance])));
  const shown = await page.locator("body").innerText();
  check("cuentas: la pantalla muestra los saldos nuevos", shown.includes("495.000") && shown.includes("15.000"));
  check("sin errores", !ctx.errors.length, ctx.errors.join(" | "));
});
