import type { Metadata } from "next";
import { ViewEmpty } from "@/components/shell/EmptyState";
import { VIEWS } from "@/lib/nav";

export const metadata: Metadata = { title: `${VIEWS.budget.label} · Albolsillo` };

export default function Page() {
  return <ViewEmpty view="budget" />;
}
