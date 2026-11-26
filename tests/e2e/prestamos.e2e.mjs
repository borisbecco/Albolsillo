// Préstamos: buscador de entidades, alta tipeando como la gente y corrección de uno con datos rotos.
import { BASE, run, newUser, login } from "./lib.mjs";

run("Préstamos", async ({ check, ctx }) => {
  const u = await newUser("prest");
  // Préstamo con datos rotos: cuota de $ 21 y saldo mayor que lo que falta
  await u.post("/loans", { name: "Prestamo Banco Galicia", installment: "21", due_day: 5, n: 18, of: 24, tna: "40", balance: "1150668000" });

  const page = await login(ctx, u, { height: 860 });
  await page.goto(BASE + "/deudas");
  await page.waitForSelector("text=Prestamo Banco Galicia");

  // Buscador de entidades
  await page.click("main:visible button:has-text('Agregar préstamo')");
  const dlg = page.locator("[role=dialog]");
  const ent = dlg.getByRole("combobox");
  await ent.click();
  check("abre la lista", (await dlg.locator("[role=option]").count()) > 40);
  await ent.pressSequentially("corri");
  const opts = await dlg.locator("[role=option]").allInnerTexts();
  check("filtra", opts[0]?.includes("Banco de Corrientes"), opts.join(" / "));
  await page.keyboard.press("Escape");
  check("Esc cierra la lista, no la hoja", (await dlg.count()) === 1 && (await dlg.locator("[role=listbox]").count()) === 0);
  await ent.click();
  await ent.fill("");
  await ent.pressSequentially("corri");
  await page.keyboard.press("Enter");
  check("elige con Enter", (await ent.inputValue()) === "Banco de Corrientes");
  const name = dlg.locator("label:has-text('Nombre') input");
  check("arma el nombre", (await name.inputValue()) === "Préstamo Banco de Corrientes");
  await ent.click();
  await ent.pressSequentially("ual");
  await dlg.locator("[role=option]:has-text('Ualá')").click();
  check("cambia el nombre", (await name.inputValue()) === "Préstamo Ualá");
  await ent.click();
  await ent.pressSequentially("Cooperativa Mi Pueblo");
  check("ofrece usar lo escrito", (await dlg.locator("[role=option]").last().innerText()).includes("Usar «Cooperativa Mi Pueblo»"));

  // Alta tipeando tecla por tecla, con puntos de miles
  await dlg.locator("label:has-text('Cuota mensual') input").click();
  check("lo escrito queda al salir", (await ent.inputValue()) === "Cooperativa Mi Pueblo");
  await dlg.locator("label:has-text('Cuota mensual') input").pressSequentially("191.778", { delay: 30 });
  await dlg.locator("label:has-text('Cuotas en total') input").pressSequentially("24");
  await dlg.locator("label:has-text('Cuotas ya pagadas') input").fill("");
  await dlg.locator("label:has-text('Cuotas ya pagadas') input").pressSequentially("18");
  await dlg.locator("label:has-text('Día de vencimiento') input").fill("5");
  await dlg.locator("button:has-text('Agregar préstamo')").click();
  await page.waitForTimeout(1200);
  let loans = (await u.get("/loans")).loans;
  const coop = loans.find((l) => l.lender === "Cooperativa Mi Pueblo");
  check("guarda entidad, nombre y cuota", coop?.name === "Préstamo Cooperativa Mi Pueblo" && coop?.installment === "191778.00" && coop?.n === 18 && coop?.of === 24, JSON.stringify(coop));

  // Editar el roto
  const broken = page.locator("main:visible li, main:visible article, main:visible section").filter({ hasText: "Prestamo Banco Galicia" }).last();
  await broken.locator("button[title*=Editar], button[aria-label*=Editar]").first().click();
  const e = page.locator("[role=dialog]");
  await e.waitFor();
  check("deduce la entidad del nombre", (await e.getByRole("combobox").inputValue()) === "Galicia");
  check("muestra aviso de saldo", (await e.innerText()).includes("es mayor que lo que te falta"));
  check("pregunta si pagó la cuota del mes", (await e.innerText()).includes("Ya pagué la cuota de"));
  const cuota = e.locator("label:has-text('Cuota mensual') input");
  await cuota.click();
  await page.keyboard.press("Control+A");
  await cuota.pressSequentially("191.778", { delay: 30 });
  await e.locator("label:has-text('Ya pagué') input").check();
  await e.locator("button:has-text('Guardar cambios')").click();
  await page.waitForTimeout(1500);
  loans = (await u.get("/loans")).loans;
  const gal = loans.find((l) => l.name === "Prestamo Banco Galicia");
  check("guarda la cuota corregida y el mes pagado", gal?.installment === "191778.00" && !!gal?.last_paid_month, JSON.stringify(gal));
  check("sin errores", !ctx.errors.length, ctx.errors.join(" | "));
});
