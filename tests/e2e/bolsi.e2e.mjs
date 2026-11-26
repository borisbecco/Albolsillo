// Bolsi se anima en Primeros pasos y en los avisos (más grande en la compu).
import { run, newUser, login } from "./lib.mjs";

const state = (page, sel) =>
  page.evaluate((s) => {
    const host = document.querySelector(s);
    if (!host) return "no está";
    if (!host.shadowRoot?.querySelector("svg")) return "sin svg";
    const anims = host.shadowRoot.getAnimations?.() ?? [];
    return { running: anims.filter((a) => a.playState === "running").length, w: Math.round(host.getBoundingClientRect().width) };
  }, sel);

run("Bolsi", async ({ check, ctx }) => {
  const u = await newUser("bolsi");
  await u.account("Galicia");
  const page = await login(ctx, u, { waitFor: "[data-bolsi=bienvenida]" });
  await page.waitForTimeout(800);
  const a = await state(page, "[data-bolsi=bienvenida]");
  check("Primeros pasos: Bolsi animado", a.running > 0, JSON.stringify(a));

  await page.keyboard.press("n");
  const dlg = page.locator("[role=dialog]").last();
  await dlg.waitFor();
  await page.keyboard.type("2500");
  await dlg.locator("input[placeholder^='Descripción']").fill("Kiosco");
  await dlg.locator("button").filter({ hasText: /^Guardar/ }).last().click();
  await page.waitForSelector("[role=status] [data-bolsi=gasto]", { timeout: 8000 });
  await page.waitForTimeout(500);
  const g = await state(page, "[role=status] [data-bolsi=gasto]");
  check("aviso de gasto: Bolsi animado y grande en la compu", g.running > 0 && g.w === 64, JSON.stringify(g));
  check("sin errores", !ctx.errors.length, ctx.errors.join(" | "));
});
