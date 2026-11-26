// Navegación: pestañas e indicadores marcan al instante, alineados, y cada vista arranca arriba.
import { BASE, run, newUser, login } from "./lib.mjs";

const aligned = (page, indSel, activeSel) =>
  page.evaluate(
    ([a, b]) => {
      const i = document.querySelector(a)?.getBoundingClientRect();
      const t = document.querySelector(b)?.getBoundingClientRect();
      if (!i || !t) return "falta " + (!i ? a : b);
      return Math.abs(i.left - t.left) < 2 && Math.abs(i.top - t.top) < 2 && Math.abs(i.width - t.width) < 2
        ? true
        : `${Math.round(i.left)},${Math.round(i.top)},${Math.round(i.width)} vs ${Math.round(t.left)},${Math.round(t.top)},${Math.round(t.width)}`;
    },
    [indSel, activeSel],
  );

/** Hace click en el link y devuelve si quedó marcado en el mismo frame. */
const clickNow = (page, sel, text) =>
  page.evaluate(
    async ([s, txt]) => {
      const a = [...document.querySelectorAll(s)].find((x) => x.textContent.includes(txt));
      a.click();
      await new Promise((r) => requestAnimationFrame(() => r()));
      return a.getAttribute("aria-current");
    },
    [sel, text],
  );

run("Navegación", async ({ check, ctx }) => {
  const u = await newUser("nav");
  const acc = await u.account("Galicia", "banco", "100000");
  for (let i = 0; i < 40; i++) await u.tx({ description: `Gasto ${i}`, category_id: "super", amount: "1000", account_id: acc.id });

  const page = await login(ctx, u, { height: 860 });
  await page.waitForTimeout(800);
  const sub = "main nav[aria-label='Día a día']";
  let a = await aligned(page, `${sub} > span`, `${sub} a[aria-current=page]`);
  check("indicador de pestañas alineado al entrar", a === true, String(a));
  a = await aligned(page, "aside > span", "aside a[aria-current=page] [data-ind]");
  check("indicador lateral alineado", a === true, String(a));

  const marked = await clickNow(page, `${sub} a`, "Movimientos");
  check("pestaña marcada al instante", marked === "page", String(marked));
  await page.waitForURL("**/movimientos");
  await page.waitForTimeout(600);
  a = await aligned(page, `${sub} > span`, `${sub} a[aria-current=page]`);
  check("indicador llega a Movimientos", a === true, String(a));

  // Scroll abajo, ir a Cuentas: vuelve arriba
  const scroller = "main [class*=scroll]";
  await page.evaluate((s) => (document.querySelector(s).scrollTop = 900), scroller);
  const before = await page.evaluate((s) => document.querySelector(s).scrollTop, scroller);
  await page.click(`${sub} a:has-text('Cuentas')`);
  await page.waitForURL("**/cuentas");
  await page.waitForTimeout(400);
  const after = await page.evaluate((s) => document.querySelector(s).scrollTop, scroller);
  check("vuelve arriba al cambiar de vista", before > 0 && after === 0, `${before} → ${after}`);

  // Otra sección desde la barra lateral
  await page.click("aside a[title^='Deudas']");
  await page.waitForURL("**/deudas");
  await page.waitForTimeout(600);
  check("indicador lateral en Deudas", (await aligned(page, "aside > span", "aside a[aria-current=page] [data-ind]")) === true);
  check("pestañas de Deudas alineadas", (await aligned(page, "main nav[aria-label='Deudas'] > span", "main nav[aria-label='Deudas'] a[aria-current=page]")) === true);

  // Celular
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(BASE + "/");
  await page.waitForSelector("nav[aria-label=Secciones] a[aria-current=page]", { timeout: 20000 });
  await page.waitForTimeout(800);
  check("barra de abajo marca al instante", (await clickNow(page, "nav[aria-label=Secciones] a", "Planificar")) === "page");
  await page.waitForURL("**/plan");
  await page.waitForTimeout(600);
  const subM = "main nav[aria-label='Planificación']";
  a = await aligned(page, `${subM} > span`, `${subM} a[aria-current=page]`);
  check("pestañas en el celular alineadas", a === true, String(a));
  check("sin errores", !ctx.errors.length, ctx.errors.join(" | "));
});
