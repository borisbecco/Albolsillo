import type { Metadata } from "next";
import { CalendarView } from "@/components/debts/CalendarView";
import { VIEWS } from "@/lib/nav";

export const metadata: Metadata = { title: `${VIEWS.cal.label} · Albolsillo` };

export default function Page() {
  return <CalendarView />;
}
