import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of Use | GFX Society" };

export default function Page() {
  return <LegalPage file="terms-of-use.md" />;
}
