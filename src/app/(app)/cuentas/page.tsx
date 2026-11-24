import type { Metadata } from "next";
import { AccountsView } from "@/components/accounts/AccountsView";
import { VIEWS } from "@/lib/nav";

export const metadata: Metadata = { title: `${VIEWS.acc.label} · Albolsillo` };

export default function Page() {
  return <AccountsView />;
}
