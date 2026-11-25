import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId, toUserDto } from "@/lib/auth/session";
import { accountDto, billDto, cardDto } from "@/lib/dto";
import { findEntity } from "@/lib/entities";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { detectBank, detectNetwork, estimateCloseDay } from "@/lib/banks";

const money = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Revisá los montos");
const day = z.number().int().min(1, "El día va de 1 a 31").max(31, "El día va de 1 a 31");

const CardIn = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Poné un nombre a cada tarjeta").max(60),
  balance: money,
  min_payment: money,
  due_day: day,
  close_day: day.optional(),
  tna: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Revisá la TNA"),
  last4: z.string().regex(/^\d{4}$/, "Los últimos 4 son 4 números").nullable().optional(),
});

const BillIn = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Poné un nombre a cada gasto fijo").max(80),
  amount: money,
  currency: z.enum(["ARS", "USD"]).default("ARS"),
  due_day: day,
  category_id: z.string().refine((id) => CATEGORY_BY_ID[id]?.type === "out", "Revisá la categoría"),
});

const Body = z.union([
  z.object({ skipped: z.literal(true) }),
  z.object({
    salary: money.nullable(),
    payday: day.nullable(),
    usd_income: money.nullable(),
    salary_currency: z.enum(["ARS", "USD"]).default("ARS"),
    other_income_currency: z.enum(["ARS", "USD"]).default("USD"),
    /** Cuenta donde te depositan el sueldo, o un banco/billetera nuevo para crearla */
    salary_account_id: z.uuid().nullable().optional(),
    salary_bank: z.string().trim().min(1).max(60).nullable().optional(),
    /** Lo mismo para los otros ingresos, más el día en que entran */
    other_income_account_id: z.uuid().nullable().optional(),
    other_income_bank: z.string().trim().min(1).max(60).nullable().optional(),
    other_income_day: day.nullable().optional(),
    cards: z.array(CardIn).max(20),
    bills: z.array(BillIn).max(50),
    strategy: z.enum(["intereses", "avalancha", "bola"]),
  }),
]);

// POST /me/onboarding: guarda ingresos, tarjetas, gastos fijos y estrategia de una vez.
// Al rehacerlo, las tarjetas y gastos con id se actualizan, los nuevos se crean y los que
// ya no vienen se borran (lógico).
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const b = await readBody(req, Body);

  if ("skipped" in b) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const updated = user.onboardedAt ? user : await prisma.user.update({ where: { id: userId }, data: { onboardedAt: new Date() } });
    return Response.json({ user: toUserDto(updated) });
  }

  const result = await prisma.$transaction(async (db) => {
    const now = new Date();
    // Cuenta de cada ingreso: una existente (de la misma moneda) o una nueva con saldo 0.
    // Si sueldo y otros ingresos van al mismo banco nuevo y en la misma moneda, se crea una sola.
    const created = new Map<string, Awaited<ReturnType<typeof db.account.create>>>();
    const resolve = async (accountId: string | null | undefined, bank: string | null | undefined, currency: "ARS" | "USD", what: string) => {
      if (bank) {
        const k = `${bank.toLowerCase()}|${currency}`;
        if (!created.has(k)) {
          created.set(k, await db.account.create({ data: { userId, name: bank, kind: findEntity(bank)?.kind === "billetera" ? "billetera" : "banco", currency, balance: "0" } }));
        }
        return created.get(k)!.id;
      }
      if (!accountId) return accountId;
      const acc = await db.account.findFirst({ where: { id: accountId, userId, deletedAt: null } });
      if (!acc) throw new ApiError(422, "validation", `Elegí una de tus cuentas para ${what}.`);
      if (acc.currency !== currency) throw new ApiError(422, "validation", `${what[0].toUpperCase()}${what.slice(1)} es en ${currency === "USD" ? "dólares" : "pesos"}: elegí una cuenta en esa moneda.`);
      return accountId;
    };
    const salaryAccountId = await resolve(b.salary_account_id, b.salary_bank, b.salary_currency, "el sueldo");
    const otherIncomeAccountId = await resolve(b.other_income_account_id, b.other_income_bank, b.other_income_currency, "los otros ingresos");
    const user = await db.user.update({
      where: { id: userId },
      data: { salaryAccountId, otherIncomeAccountId, otherIncomeDay: b.other_income_day, salary: b.salary, payday: b.payday, usdIncome: b.usd_income, salaryCurrency: b.salary_currency, otherIncomeCurrency: b.other_income_currency, payStrategy: b.strategy, onboardedAt: now },
    });

    // Tarjetas
    const existingCards = await db.card.findMany({ where: { userId, deletedAt: null }, select: { id: true } });
    const keepCards = new Set(b.cards.map((c) => c.id).filter(Boolean));
    await db.card.updateMany({
      where: { userId, deletedAt: null, id: { in: existingCards.map((c) => c.id).filter((id) => !keepCards.has(id)) } },
      data: { deletedAt: now },
    });
    for (const c of b.cards) {
      const data = {
        name: c.name,
        bank: detectBank(c.name),
        network: detectNetwork(c.name),
        last4: c.last4 ?? null,
        balance: c.balance,
        minPayment: c.min_payment,
        dueDay: c.due_day,
        closeDay: c.close_day ?? estimateCloseDay(c.due_day),
        tna: c.tna,
      };
      const own = c.id && existingCards.some((x) => x.id === c.id);
      if (own) await db.card.update({ where: { id: c.id }, data });
      else await db.card.create({ data: { userId, ...data } });
    }

    // Gastos fijos
    const existingBills = await db.bill.findMany({ where: { userId, deletedAt: null }, select: { id: true } });
    const keepBills = new Set(b.bills.map((x) => x.id).filter(Boolean));
    await db.bill.updateMany({
      where: { userId, deletedAt: null, id: { in: existingBills.map((x) => x.id).filter((id) => !keepBills.has(id)) } },
      data: { deletedAt: now },
    });
    for (const x of b.bills) {
      const data = { name: x.name, amount: x.amount, currency: x.currency, dueDay: x.due_day, categoryId: x.category_id };
      const own = x.id && existingBills.some((e) => e.id === x.id);
      if (own) await db.bill.update({ where: { id: x.id }, data });
      else await db.bill.create({ data: { userId, ...data } });
    }

    const [cards, bills] = await Promise.all([
      db.card.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "asc" } }),
      db.bill.findMany({ where: { userId, deletedAt: null }, orderBy: [{ dueDay: "asc" }, { createdAt: "asc" }] }),
    ]);
    return { user, cards, bills, newAccounts: [...created.values()] };
  }, { timeout: 20_000 }); // varias consultas contra una base remota

  return Response.json({ user: toUserDto(result.user), cards: result.cards.map(cardDto), bills: result.bills.map(billDto), accounts: result.newAccounts.map(accountDto) });
});
