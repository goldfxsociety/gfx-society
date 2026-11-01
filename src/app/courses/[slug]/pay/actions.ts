"use server";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { QR_URL_TTL_SECONDS, RECEIPT_MAX_BYTES } from "@/config/training";

/** B5: fresh ~5 min signed URL for the GCash QR. Storage RLS limits this to members/admins. */
export async function getQrUrl(): Promise<{ url: string } | { error: "unavailable" }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("payment-assets").createSignedUrl("gcash-qr.png", QR_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return { error: "unavailable" };
  return { url: data.signedUrl };
}

function sniff(b: Uint8Array): "png" | "jpg" | "pdf" | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  return null;
}

export type SubmitResult =
  | { ok: true; paymentCode: string }
  | { ok: false; error: "type" | "size" | "upload" | "duplicate" | "not_allowed" | "network" };

/**
 * The browser uploads the receipt straight to receipts/{uid}/{uuid}.{ext} (storage RLS: own folder, members only),
 * so 5 MB files don't hit the Server Action body limit. Here we re-read it, check size + magic bytes, hash it,
 * and submit. Ref format and amount are soft flags computed in the DB; they never block.
 */
export async function submitReceipt(input: {
  slug: string;
  amount: string;
  gcashRef: string;
  receiptPath: string;
}): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_allowed" };
  const path = input.receiptPath;
  const m = /^([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|pdf)$/.exec(path);
  if (!m || m[1] !== user.id) return { ok: false, error: "upload" };
  const remove = () => supabase.storage.from("receipts").remove([path]);

  const { data: blob, error: dlErr } = await supabase.storage.from("receipts").download(path);
  if (dlErr || !blob) return { ok: false, error: "upload" };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength > RECEIPT_MAX_BYTES) {
    await remove();
    return { ok: false, error: "size" };
  }
  if (sniff(bytes) !== m[2]) {
    await remove();
    return { ok: false, error: "type" };
  }
  const sha = createHash("sha256").update(bytes).digest("hex");
  const amount = Number(input.amount);

  const { data, error } = await supabase.rpc("submit_course_purchase", {
    p_course_slug: input.slug,
    p_amount_entered: Number.isFinite(amount) ? amount : 0,
    p_gcash_ref: input.gcashRef,
    p_receipt_path: path,
    p_receipt_sha256: sha,
  });
  if (error) {
    await remove();
    console.error("[pay] submit failed", { code: error.code });
    if (error.code === "23505") return { ok: false, error: "duplicate" };
    if (error.code === "42501" || error.code === "P0002") return { ok: false, error: "not_allowed" };
    return { ok: false, error: "network" };
  }
  const res = data as { payment_code: string; old_receipt_path: string | null };
  // B4: re-upload replaces the old receipt; delete the old file (owner may delete unreferenced files).
  if (res.old_receipt_path) await supabase.storage.from("receipts").remove([res.old_receipt_path]);
  return { ok: true, paymentCode: res.payment_code };
}
