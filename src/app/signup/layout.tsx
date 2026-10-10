import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create your free account",
  alternates: { canonical: "/signup" },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
