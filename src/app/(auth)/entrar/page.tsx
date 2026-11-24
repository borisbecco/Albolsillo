import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Iniciá sesión · Albolsillo" };

export default function Page() {
  return <LoginForm />;
}
