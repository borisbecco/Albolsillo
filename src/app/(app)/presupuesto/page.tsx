import type { Metadata } from "next";
import { BudgetView } from "@/components/budget/BudgetView";
import { VIEWS } from "@/lib/nav";

export const metadata: Metadata = { title: `${VIEWS.budget.label} · Albolsillo` };

export default function Page() {
  return <BudgetView />;
}
