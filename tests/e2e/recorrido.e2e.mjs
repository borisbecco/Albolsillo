// Recorrido guiado de un usuario nuevo: muestra un caso de ejemplo y no guarda nada.
import { BASE, run, newUser, login } from "./lib.mjs";

run("Recorrido guiado", async ({ check, ctx }) => {
  const u = await newUser("tour", {
    onboarding: { salary: "1500000.00", payday: 1, usd_income: null, salary_bank: "Galicia", cards: [], bills: [], strategy: "intereses" },
    tour: false,
  });
  const page = await login(ctx, u, { height: 860 });
  await page.evaluate(() => sessionStorage.setItem("ab-start-tour", "1"));
  await page.goto(BASE + "/");
  const box = page.locator("[role=dialog][aria-label='Recorrido guiado']");
  await box.waitFor({ timeout: 10000 });
  check("etiqueta 'Datos de ejemplo'", (await box.innerText()).includes("Datos de ejemplo"));
  for (let i = 1; i <= 7; i++) {
    await page.waitForTimeout(1500);
    const title = (await box.locator("strong").first().innerText()).trim();
    check(`paso ${i} señala algo`, (await page.locator("[class*=tourSpot]").count()) === 1, title);
    await box.locator("button:has-text('Siguiente'), button:has-text('Terminar')").last().click();
  }
  await page.waitForTimeout(1500);
  check("al terminar vuelve a Primeros pasos (sin datos)", (await page.locator("text=Arranquemos").count()) === 1);
  const real = await u.get("/me/bootstrap");
  check("no se guardó nada (solo la cuenta del sueldo)", real.transactions.length === 0 && real.accounts.length === 1 && real.cards.length === 0);
  check("sin errores", !ctx.errors.length, ctx.errors.join(" | "));
});
