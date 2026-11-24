import type { Metadata } from "next";
import { OnboardingView } from "@/components/onboarding/OnboardingView";

export const metadata: Metadata = { title: "Armemos tu plan · Albolsillo" };

export default function Page() {
  return <OnboardingView />;
}
