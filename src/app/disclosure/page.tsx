import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "IB Disclosure | GFX Society" };

export default function Page() {
  return <LegalPage file="ib-disclosure.md" />;
}
