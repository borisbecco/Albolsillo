// Primeros pasos con sueldo y otros ingresos en dólares: crea las cuentas y avisa el cobro.
import { run, newUser, login } from "./lib.mjs";

run("Ingresos en la bienvenida", async ({ check, ctx }) => {
  const u = await newUser("ingr", { onboarding: null, tour: false });
  const page = await login(ctx, u, { waitFor: "text=¿Dónde te depositan el sueldo?" });
  check("otros ingresos: sin cuenta hasta poner monto", (await page.locator("text=¿Dónde los recibís?").count()) === 0);
  await page.locator("input[placeholder='2.400.000']").pressSequentially("1.500.000");
  await page.locator("input[placeholder='1']").first().fill("1");
  let combos = page.getByRole("combobox");
  await combos.nth(0).click();
  await combos.nth(0).pressSequentially("galic");
  await page.keyboard.press("Enter");
  const otherField = page.locator("label", { hasText: "Otros ingresos mensuales" });
  await otherField.locator("button:has-text('US$')").click().catch(() => {});
  await otherField.locator("input").pressSequentially("500");
  await page.waitForSelector("text=¿Dónde los recibís?");
  check("aparece la cuenta de otros ingresos", true);
  await page.locator("label", { hasText: "Día en que entran" }).locator("input").fill("1");
  combos = page.getByRole("combobox");
  await combos.nth(1).click();
  await combos.nth(1).pressSequentially("wise");
  await page.keyboard.press("Enter");
  check("explica que crea Wise en dólares", await page.locator("text=Creamos la cuenta Wise en dólares").isVisible());
  for (let i = 0; i < 3; i++) await page.click("button:has-text('Siguiente')");
  await page.click("button:has-text('Armar mi plan')");
  await page.waitForURL((url) => !url.pathname.startsWith("/bienvenida"), { timeout: 15000 });
  await page.waitForSelector("text=¿Ya cobraste tus otros ingresos?", { timeout: 15000 });
  check("dos avisos", (await page.locator("text=¿Ya cobraste el sueldo?").count()) === 1);
  // El recorrido guiado arranca solo para un usuario nuevo
  await page.locator("button:has-text('Saltar')").click().catch(() => {});
  await page.waitForTimeout(400);
  const other = page.locator("[aria-label='Otros ingresos del mes']");
  check("otros: cuenta Wise y US$", (await other.locator("select option:checked").innerText()) === "Wise" && (await other.innerText()).includes("US$"));
  await other.locator("button:has-text('Sumar')").click();
  await page.waitForSelector("text=Sumamos US$ 500 a Wise", { timeout: 8000 });
  await page.waitForTimeout(1200);
  const accs = (await u.get("/accounts")).accounts;
  const wise = accs.find((a) => a.name === "Wise");
  check(
    "cuentas creadas y Wise acreditada",
    wise?.currency === "USD" && wise?.balance === "500.00" && accs.find((a) => a.name === "Galicia")?.currency === "ARS",
    JSON.stringify(accs.map((a) => [a.name, a.currency, a.balance])),
  );
  check("queda el del sueldo", (await page.locator("[aria-label='Sueldo del mes']").count()) === 1 && (await other.count()) === 0);
  check("sin errores", !ctx.errors.length, ctx.errors.join(" | "));
});
