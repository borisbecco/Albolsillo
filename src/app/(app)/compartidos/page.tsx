import type { Metadata } from "next";
import { SharedView } from "@/components/shared/SharedView";
import { VIEWS } from "@/lib/nav";

export const metadata: Metadata = { title: `${VIEWS.shared.label} · Albolsillo` };

export default function Page() {
  return <SharedView />;
}
