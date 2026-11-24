import type { Metadata } from "next";
import { DebtsView } from "@/components/debts/DebtsView";
import { VIEWS } from "@/lib/nav";

export const metadata: Metadata = { title: `${VIEWS.debts.label} · Albolsillo` };

export default function Page() {
  return <DebtsView />;
}
