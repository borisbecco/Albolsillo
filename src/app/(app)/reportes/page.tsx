import type { Metadata } from "next";
import { ReportsView } from "@/components/reports/ReportsView";
import { VIEWS } from "@/lib/nav";

export const metadata: Metadata = { title: `${VIEWS.rep.label} · Albolsillo` };

export default function Page() {
  return <ReportsView />;
}
