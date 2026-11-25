import type { Metadata } from "next";
import { ProjectionView } from "@/components/projection/ProjectionView";
import { VIEWS } from "@/lib/nav";

export const metadata: Metadata = { title: `${VIEWS.proj.label} · Albolsillo` };

export default function Page() {
  return <ProjectionView />;
}
