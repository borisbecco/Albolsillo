import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Creá tu cuenta · Albolsillo" };

export default function Page() {
  return <RegisterForm />;
}
