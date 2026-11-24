import { SessionGate } from "@/components/SessionGate";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <SessionGate>{children}</SessionGate>;
}
