import { prisma } from "@/lib/db";
import { ApiError, handle } from "@/lib/http";
import { requireUserId, toUserDto } from "@/lib/auth/session";
import { accountDto, billDto, cardDto, installmentDto, personDto, txDto } from "@/lib/dto";
import { addMonths, currentMonth } from "@/lib/month";
import { monthRange } from "@/lib/transactions";
import { goalDto, investmentDto } from "@/lib/savings";
import { sharedDto } from "@/lib/shared";

// GET /me/bootstrap?month=YYYY-MM: todo lo que necesita la app al abrir.
// Incluye las transacciones de los 6 meses que terminan en `month`.
export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const param = new URL(req.url).searchParams.get("month");
  const month = param && /^\d{4}-\d{2}$/.test(param) ? param : currentMonth();

  const live = { userId, deletedAt: null };
  const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5));
  const [user, accounts, cards, people, transactions, bills, billPayments, budgets, goals, investments, shared, installments] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, deletedAt: null } }),
    prisma.account.findMany({ where: live, orderBy: { createdAt: "asc" } }),
    prisma.card.findMany({ where: live, orderBy: { createdAt: "asc" } }),
    prisma.person.findMany({ where: live, orderBy: { createdAt: "asc" } }),
    prisma.transaction.findMany({
      where: { ...live, date: { gte: monthRange(addMonths(month, -5)).gte, lt: monthRange(month).lt } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.bill.findMany({ where: live, orderBy: [{ dueDay: "asc" }, { createdAt: "asc" }] }),
    prisma.billPayment.findMany({ where: { ...live, month: { in: months } } }),
    prisma.budget.findMany({ where: { ...live, month: { in: months } } }),
    prisma.goal.findMany({ where: live, orderBy: { createdAt: "asc" } }),
    prisma.investment.findMany({ where: { ...live, closedAt: null }, orderBy: { startDate: "asc" } }),
    prisma.sharedExpense.findMany({ where: live, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    prisma.cardInstallment.findMany({ where: live, orderBy: { createdAt: "asc" } }),
  ]);
  if (!user) throw new ApiError(401, "session_expired", "Tu sesión venció.");

  return Response.json({
    user: toUserDto(user),
    month,
    accounts: accounts.map(accountDto),
    cards: cards.map(cardDto),
    installments: installments.map(installmentDto),
    people: people.map(personDto),
    transactions: transactions.map(txDto),
    bills: bills.map(billDto),
    bill_payments: billPayments.map((p) => ({ bill_id: p.billId, month: p.month, transaction_id: p.transactionId })),
    loans: [],
    budgets: budgets.map((b) => ({ month: b.month, category_id: b.categoryId, amount: b.amount.toFixed(2) })),
    goals: goals.map(goalDto),
    investments: investments.map(investmentDto),
    shared: shared.map(sharedDto),
  });
});
