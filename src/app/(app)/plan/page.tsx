import type { Metadata } from "next";
import { PlanView } from "@/components/plan/PlanView";
import { VIEWS } from "@/lib/nav";

export const metadata: Metadata = { title: `${VIEWS.plan.label} · Albolsillo` };

export default function Page() {
  return <PlanView />;
}
