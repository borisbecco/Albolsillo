import type { Metadata } from "next";
import { ViewEmpty } from "@/components/shell/EmptyState";
import { VIEWS } from "@/lib/nav";

export const metadata: Metadata = { title: `${VIEWS.cal.label} · Albolsillo` };

export default function Page() {
  return <ViewEmpty view="cal" />;
}
