import type { Metadata } from "next";
import { GoalsView } from "@/components/savings/GoalsView";
import { VIEWS } from "@/lib/nav";

export const metadata: Metadata = { title: `${VIEWS.goals.label} · Albolsillo` };

export default function Page() {
  return <GoalsView />;
}
