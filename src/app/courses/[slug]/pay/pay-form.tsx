"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/client";
import { APPROVAL_TIME, RECEIPT_MAX_BYTES } from "@/config/training";
import { isValidGcashRef, normalizeGcashRef } from "@/lib/training/gcash-ref";
import { Chip } from "@/components/training/chip";
import { RefundLine } from "@/components/training/refund-line";
import { getQrUrl, submitReceipt } from "./actions";

type Props = {
  slug: string;
  userId: string;
  title: string;
  price: number;
  paymentCode: string;
  rejectReason: string | null;
  holderName: string;
  gcashNumber: string;
};

const EXT: Record<string, "jpg" | "png" | "pdf"> = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };
const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

const SERVER_ERR: Record<string, string> = {
  duplicate: "May pending o approved ka nang purchase para sa course na ito. Tingnan sa /account.",
  network: "Hindi na-submit. Hindi ka pa nasisingil ulit; subukan ulit.",
  upload: "Hindi na-upload. Check ang connection mo at subukan ulit.",
  type: "JPG, PNG o PDF lang ang puwede.",
  size: "Masyadong malaki ang file (max 5 MB). Subukan ang screenshot imbes na photo.",
  not_allowed: "Hindi puwedeng i-submit ngayon. I-refresh ang page at subukan ulit.",
};

function QrBlock({ holderName, gcashNumber, onLive }: { holderName: string; gcashNumber: string; onLive: (m: string) => void }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed" | "error">("loading");
  const [url, setUrl] = useState<string | null>(null);
  const load = useCallback(async () => {
    setState("loading");
    const r = await getQrUrl();
    if ("url" in r) {
      setUrl(r.url);
    } else {
      setUrl(null);
      setState("error");
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch fresh signed URL on mount
    void load();
  }, [load]);

  return (
    <section aria-labelledby="qr-h" className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4">
      <h2 id="qr-h" className="sr-only">GCash QR</h2>
      {state === "error" ? (
        <p role="alert" className="text-sm">
          Hindi ma-load ang QR ngayon. Puwede mong i-send gamit ang GCash number sa baba, o subukan ulit mamaya.
        </p>
      ) : state === "failed" ? (
        <div className="flex h-[240px] w-[240px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-3 text-center text-sm">
          <p>Hindi na-load ang QR.</p>
        </div>
      ) : (
        <div className="relative h-[240px] w-[240px]" aria-busy={state === "loading"}>
          {state === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-muted text-sm">Loading QR…</div>
          )}
          {url && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; must not be cached/optimized
            <img
              src={url}
              width={240}
              height={240}
              alt={`GCash QR code for paying GoldFX Society. Account name: ${holderName || "GoldFX Society"}.`}
              onLoad={() => {
                setState("loaded");
                onLive("Na-load ang QR.");
              }}
              onError={() => {
                setState("failed");
                onLive("Hindi na-load ang QR.");
              }}
              className="h-[240px] w-[240px] rounded-md bg-white object-contain"
            />
          )}
        </div>
      )}
      <Button type="button" variant="outline" className="min-h-11" onClick={() => void load()}>
        Show QR again
      </Button>
      {holderName && <p className="text-sm">Account name: {holderName}</p>}
      {gcashNumber && <p className="text-sm">GCash no.: {gcashNumber}</p>}
      <p className="text-center text-xs text-muted-foreground">
        Puwede mong i-screenshot ang QR at i-scan sa GCash app (Pay QR → Upload from gallery).
      </p>
    </section>
  );
}

export function PayForm(p: Props) {
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(p.paymentCode);
      setLive("Na-copy ang reference code.");
    } catch {
      const el = document.getElementById("pay-code");
      if (el) window.getSelection()?.selectAllChildren(el);
    }
  }

  function pickFile(f: File | null) {
    setFile(f);
    setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    if (fileInput.current && !f) fileInput.current.value = "";
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    const n = Number(amount);
    if (!amount.trim() || !Number.isFinite(n) || n <= 0 || !/^\d+(\.\d{1,2})?$/.test(amount.trim()))
      e.amount = "Ilagay ang amount na na-send mo, e.g. 2000.";
    if (!normalizeGcashRef(ref)) e.ref = "Ilagay ang GCash Ref No. mula sa receipt.";
    if (!file) e.file = "Pumili ng receipt (JPG, PNG o PDF).";
    else if (!EXT[file.type]) e.file = SERVER_ERR.type;
    else if (file.size > RECEIPT_MAX_BYTES) e.file = SERVER_ERR.size;
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setServerErr(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setBusy(true);
    setLive("Ina-upload ang receipt…");
    const path = `${p.userId}/${crypto.randomUUID()}.${EXT[file!.type]}`;
    const supabase = createClient();
    const up = await supabase.storage.from("receipts").upload(path, file!, { contentType: file!.type, upsert: false });
    if (up.error) {
      setBusy(false);
      setServerErr(SERVER_ERR.upload);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    const r = await submitReceipt({ slug: p.slug, amount: amount.trim(), gcashRef: ref, receiptPath: path }).catch(
      () => ({ ok: false, error: "network" }) as const,
    );
    setBusy(false);
    if (r.ok) {
      setDone(r.paymentCode);
      setLive("Natanggap namin ang receipt mo.");
      window.scrollTo({ top: 0 });
    } else {
      setServerErr(SERVER_ERR[r.error] ?? SERVER_ERR.network);
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  }

  if (done) {
    return (
      <section className="flex flex-col gap-3" aria-live="polite">
        <p aria-hidden className="text-3xl text-green-400">✓</p>
        <h1 className="text-2xl font-bold tracking-tight">Natanggap namin ang receipt mo</h1>
        <p className="text-sm">
          {p.title} · {peso(p.price)} · Ref {done}
        </p>
        <p className="text-sm">
          Status: <Chip tone="amber">Pending review</Chip>
        </p>
        <p className="text-sm">GCash Ref No.: {normalizeGcashRef(ref)}</p>
        <p className="text-sm">Ive-verify ni GFX ang bayad mo within {APPROVAL_TIME}.</p>
        <p className="text-sm text-muted-foreground">Wala pa kaming email updates. Check /account para sa status.</p>
        <Link href="/account" className={cn(buttonVariants({ variant: "default" }), "min-h-11 w-full")}>
          Go to My courses →
        </Link>
      </section>
    );
  }

  const errList = Object.entries(errors);
  const amountDiffers = amount.trim() !== "" && Number(amount) !== p.price && !errors.amount;
  const refLooksOff = ref.trim() !== "" && !isValidGcashRef(ref);

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
      <h1 className="text-2xl font-bold tracking-tight">Bayaran ang course</h1>
      {p.rejectReason && (
        <p className="rounded-lg border border-red-500/70 p-3 text-sm">
          Hindi na-approve: <strong>{p.rejectReason}</strong>. Puwede kang mag-upload ulit gamit ang parehong GFX reference code.
        </p>
      )}
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <p className="font-semibold">{p.title}</p>
        <p className="text-sm">{peso(p.price)} · one-time</p>
        <p className="text-sm">Your GFX reference code:</p>
        <div className="flex items-center gap-2">
          <span id="pay-code" className="font-mono text-lg font-bold tracking-wider">
            {p.paymentCode}
          </span>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void copy()}>
            Copy
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Ito ang ilalagay mo sa GCash message. Iba ito sa GCash Ref No. na makikita sa receipt.
        </p>
      </section>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>Mag-send ng {peso(p.price)} sa GCash QR o number sa baba.</li>
        <li>Ilagay ang reference code {p.paymentCode} sa message.</li>
        <li>I-screenshot ang GCash receipt.</li>
        <li>I-upload dito ang receipt at ilagay ang GCash Ref No.</li>
      </ol>
      <QrBlock holderName={p.holderName} gcashNumber={p.gcashNumber} onLive={setLive} />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {(errList.length > 0 || serverErr) && (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-lg border border-red-500/70 p-3 text-sm">
            {serverErr ?? (
              <>
                <p>May kailangang ayusin bago i-submit:</p>
                <ul className="list-disc pl-5">
                  {errList.map(([k, m]) => (
                    <li key={k}>
                      <a href={`#f-${k}`} className="underline">
                        {m}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="f-amount" className="text-sm font-medium">
            Magkano ang na-send mo? (₱)
          </label>
          <input
            id="f-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={errors.amount ? "e-amount" : amountDiffers ? "n-amount" : undefined}
            className="min-h-11 rounded-md border border-border bg-background px-3"
          />
          {errors.amount && <p id="e-amount" className="text-sm text-red-300">{errors.amount}</p>}
          {amountDiffers && (
            <p id="n-amount" className="text-sm text-muted-foreground">
              Iba ito sa course price na {peso(p.price)}. Okay lang i-submit; ive-check ni GFX.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-ref" className="text-sm font-medium">
            GCash Ref No.
          </label>
          <input
            id="f-ref"
            inputMode="numeric"
            autoComplete="off"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            aria-invalid={Boolean(errors.ref)}
            aria-describedby="h-ref"
            className="min-h-11 rounded-md border border-border bg-background px-3"
          />
          <p id="h-ref" className="text-xs text-muted-foreground">
            13 digits, nasa GCash receipt (e.g. 1234 567 890123)
          </p>
          {errors.ref && <p className="text-sm text-red-300">{errors.ref}</p>}
          {/* Soft check only: never blocks submit (Jarvis, 2 Nov). */}
          {!errors.ref && refLooksOff && (
            <p className="text-sm text-muted-foreground">Usually 13 digits ang GCash Ref No. Check ulit ang receipt mo.</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-file" className="text-sm font-medium">
            Receipt
          </label>
          <input
            ref={fileInput}
            id="f-file"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            aria-describedby={errors.file ? "e-file" : "h-file"}
            className="min-h-11 text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-border file:bg-background file:px-3"
          />
          {file && (
            <div className="flex items-center gap-3 text-sm">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img src={preview} alt="Receipt preview" className="max-h-[120px] w-auto rounded" />
              ) : (
                <span aria-hidden>📄</span>
              )}
              <span>
                {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <button type="button" className="min-h-11 underline" onClick={() => fileInput.current?.click()}>
                Replace
              </button>
              <button type="button" className="min-h-11 underline" onClick={() => pickFile(null)}>
                Remove
              </button>
            </div>
          )}
          <p id="h-file" className="text-xs text-muted-foreground">
            Si GFX lang ang makakakita ng receipt mo, at binubura ito pagkatapos ma-approve o ma-reject.
          </p>
          {errors.file && <p id="e-file" className="text-sm text-red-300">{errors.file}</p>}
        </div>
        {/* Addendum D1: refund line directly above the Pay button. */}
        <RefundLine />
        <Button type="submit" className="min-h-11 w-full" aria-disabled={busy} disabled={busy}>
          {busy ? "Submitting…" : "Submit receipt →"}
        </Button>
      </form>
    </>
  );
}
