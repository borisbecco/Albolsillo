import type { Metadata } from "next";
import { MovementsView } from "@/components/tx/MovementsView";
import { VIEWS } from "@/lib/nav";

export const metadata: Metadata = { title: `${VIEWS.mov.label} · Albolsillo` };

export default function Page() {
  return <MovementsView />;
}
