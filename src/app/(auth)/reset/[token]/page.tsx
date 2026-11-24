import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "@/components/auth/ResetForm";

export const metadata: Metadata = { title: "Nueva contraseña · Albolsillo", referrer: "no-referrer" };

async function Form({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ResetForm token={token} />;
}

export default function Page({ params }: PageProps<"/reset/[token]">) {
  return (
    <Suspense>
      <Form params={params} />
    </Suspense>
  );
}
