import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/ForgotForm";

export const metadata: Metadata = { title: "Recuperá tu contraseña · Albolsillo" };

export default function Page() {
  return <ForgotForm />;
}
