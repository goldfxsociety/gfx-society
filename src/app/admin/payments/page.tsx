import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/training/gate";
import { formatPht } from "@/lib/training/time";
import { PurchaseCard, type AdminRow } from "./purchase-card";

export const metadata: Metadata = { title: "Payments | GFX admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!(await isAdmin())) notFound();
  const tab = (await searchParams).tab === "history" ? "history" : "pending";
  const supabase = await createClient();
  const [{ data, error }, { data: pend }] = await Promise.all([
    supabase.rpc("admin_list_purchases", { p_status: tab }),
    tab === "history" ? supabase.rpc("admin_list_purchases", { p_status: "pending" }) : Promise.resolve({ data: null }),
  ]);
  type Raw = Omit<AdminRow, "submitted_label" | "decided_label" | "history_count"> & {
    submitted_at: string;
    decided_at: string | null;
    history: unknown[] | null;
  };
  const rows: AdminRow[] = ((data as Raw[] | null) ?? []).map((r) => ({
    ...r,
    flags: r.flags ?? [],
    dup_codes: r.dup_codes ?? [],
    submitted_label: formatPht(r.submitted_at),
    decided_label: r.decided_at ? formatPht(r.decided_at) : null,
    history_count: Array.isArray(r.history) ? r.history.length : 0,
  }));
  const pendingCount = tab === "pending" ? rows.length : ((pend as unknown[] | null) ?? []).length;
  const tabCls = (on: boolean) =>
    `inline-flex min-h-11 items-center rounded-md px-3 text-sm ${on ? "bg-primary text-primary-foreground" : "border border-border"}`;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 px-4 pt-8 pb-24">
      <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
      <nav aria-label="Payment tabs" className="flex gap-2">
        <Link href="/admin/payments" className={tabCls(tab === "pending")} aria-current={tab === "pending" ? "page" : undefined}>
          Pending ({pendingCount})
        </Link>
        <Link href="/admin/payments?tab=history" className={tabCls(tab === "history")} aria-current={tab === "history" ? "page" : undefined}>
          History
        </Link>
      </nav>
      {error ? (
        <p role="alert">Hindi ma-load ang payments. I-refresh ang page.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tab === "pending" ? "Walang pending na receipt." : "Wala pang history."}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <PurchaseCard key={r.id} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
