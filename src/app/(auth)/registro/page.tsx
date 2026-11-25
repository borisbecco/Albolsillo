import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { invitesRequired } from "@/lib/invites";

export const metadata: Metadata = { title: "Creá tu cuenta · Albolsillo" };

// Si se pide código (INVITE_ONLY) se lee en cada visita, no al compilar.
async function Form() {
  await connection();
  return <RegisterForm inviteOnly={invitesRequired()} />;
}

export default function Page() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
