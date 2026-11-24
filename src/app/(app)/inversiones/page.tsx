import type { Metadata } from "next";
import { InvestmentsView } from "@/components/savings/InvestmentsView";
import { VIEWS } from "@/lib/nav";

export const metadata: Metadata = { title: `${VIEWS.inv.label} · Albolsillo` };

export default function Page() {
  return <InvestmentsView />;
}
