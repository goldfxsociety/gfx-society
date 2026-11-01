"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FLAG_COPY, REJECT_REASONS } from "@/config/training";
import { formatGcashRef } from "@/lib/training/gcash-ref";
import { Chip } from "@/components/training/chip";
import { decide, getReceiptUrl, retryDelete } from "./actions";

export type AdminRow = {
  id: string;
  payment_code: string;
  course_title: string;
  price_php: number;
  amount_entered: number;
  email_masked: string | null;
  gcash_ref: string;
  flags: string[];
  dup_codes: string[];
  receipt_path: string | null;
  status: string;
  submitted_label: string;
  decided_label: string | null;
  reject_reason: string | null;
  history_count: number;
};

const peso = (n: number) => `₱${Number(n).toLocaleString("en-PH")}`;

export function PurchaseCard({ row }: { row: AdminRow }) {
  const [receipt, setReceipt] = useState<{ url: string; isPdf: boolean } | null>(null);
  const [receiptErr, setReceiptErr] = useState(false);
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [reason, setReason] = useState<string>("");
  const [other, setOther] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = row.status === "pending";

  async function loadReceipt() {
    if (!row.receipt_path) return;
    setReceiptErr(false);
    const r = await getReceiptUrl(row.receipt_path);
    if ("url" in r) setReceipt({ url: r.url, isPdf: row.receipt_path.endsWith(".pdf") });
    else setReceiptErr(true);
  }

  async function confirm() {
    const finalReason = mode === "reject" ? (reason === "other" ? other.trim() : reason) : null;
    if (mode === "reject" && (!finalReason || finalReason.length < 3)) {
      setMsg("Pumili o mag-type ng reason.");
      return;
    }
    setBusy(true);
    const r = await decide(row.id, mode === "approve" ? "approved" : "rejected", finalReason);
    setBusy(false);
    if (r.ok) {
      setMsg(
        `${mode === "approve" ? "Approved" : "Rejected"} ${row.payment_code}.` +
          (r.receiptDeleted ? " Receipt deleted." : " Receipt not deleted yet; retry from History."),
      );
      setMode("idle");
    } else {
      setMsg(
        r.error === "already"
          ? "Na-decide na ito ng iba. I-refresh ang page."
          : r.error === "duplicate"
            ? "May approved purchase na gamit ang parehong GCash ref o receipt."
            : r.error === "reason"
              ? "Kailangan ng reason para mag-reject."
              : "Hindi na-save. Subukan ulit.",
      );
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono font-bold">{row.payment_code}</span>
        <span className="text-muted-foreground">{row.submitted_label}</span>
      </div>
      <p>
        {row.course_title} · {peso(row.price_php)}
      </p>
      <p>
        Amount entered: {peso(row.amount_entered)}
        {Number(row.amount_entered) !== Number(row.price_php) && <span aria-hidden> ⚠</span>}
      </p>
      <p>Member: {row.email_masked ?? "(deleted account)"}</p>
      <p>GCash Ref No.: {formatGcashRef(row.gcash_ref)}</p>
      {row.history_count > 0 && <p className="text-muted-foreground">Re-upload · {row.history_count} earlier attempt(s)</p>}
      <div className="flex flex-col gap-1">
        {row.flags.length === 0 ? (
          <p className="text-muted-foreground">No automatic flags</p>
        ) : (
          row.flags.map((f) => (
            <div key={f}>
              <Chip tone="amber">{FLAG_COPY[f]?.label ?? f}</Chip>
              <p className="mt-1 text-muted-foreground">{FLAG_COPY[f]?.explain}</p>
            </div>
          ))
        )}
        {row.dup_codes.length > 0 && <p className="text-muted-foreground">Also on: {row.dup_codes.join(", ")}</p>}
      </div>
      {row.receipt_path ? (
        <div className="flex flex-col gap-2">
          {receipt ? (
            receipt.isPdf ? (
              <a href={receipt.url} target="_blank" rel="noreferrer" className="underline">
                Open PDF receipt (link expires in 60s)
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- 60s signed URL
              <img
                src={receipt.url}
                alt={`Receipt for ${row.payment_code}`}
                onError={() => setReceiptErr(true)}
                className="max-h-[480px] w-auto rounded"
              />
            )
          ) : null}
          {receiptErr && <p role="alert">Hindi ma-load ang receipt (maaaring expired ang link).</p>}
          <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => void loadReceipt()}>
            {receipt ? "Reload receipt" : "View receipt"}
          </Button>
          {!pending && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 self-start"
              onClick={async () => setMsg((await retryDelete(row.id, row.receipt_path!)).ok ? "Receipt deleted." : "Delete failed. Retry.")}
            >
              Retry receipt delete
            </Button>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">Receipt deleted.</p>
      )}
      {!pending && (
        <p>
          <Chip tone={row.status === "approved" ? "green" : "red"}>{row.status === "approved" ? "Approved" : "Rejected"}</Chip>{" "}
          {row.decided_label} {row.reject_reason && `· ${row.reject_reason}`}
        </p>
      )}
      {pending && mode === "idle" && (
        <div className="flex gap-2">
          <Button type="button" className="min-h-11 flex-1" onClick={() => setMode("approve")}>
            Approve
          </Button>
          <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => setMode("reject")}>
            Reject
          </Button>
        </div>
      )}
      {pending && mode !== "idle" && (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          {mode === "approve" ? (
            <p>
              Approve {row.payment_code}? Mabubuksan agad ang {row.course_title} para sa member, at buburahin ang receipt.
            </p>
          ) : (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1">Reason (makikita ng member):</legend>
              {[...REJECT_REASONS, "other"].map((r) => (
                <label key={r} className="flex min-h-11 items-center gap-2">
                  <input type="radio" name={`r-${row.id}`} checked={reason === r} onChange={() => setReason(r)} />
                  {r === "other" ? "Other" : r}
                </label>
              ))}
              {reason === "other" && (
                <input
                  aria-label="Other reason"
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  className="min-h-11 rounded-md border border-border bg-background px-3"
                />
              )}
            </fieldset>
          )}
          <div className="flex gap-2">
            <Button type="button" className="min-h-11 flex-1" disabled={busy} onClick={() => void confirm()}>
              {mode === "approve" ? "Confirm approve" : "Confirm reject"}
            </Button>
            <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {msg && (
        <p role="status" className="text-sm">
          {msg}
        </p>
      )}
    </li>
  );
}
