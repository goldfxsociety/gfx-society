"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RECEIPT_URL_TTL_SECONDS } from "@/config/training";
import { isAdmin } from "@/lib/training/gate";

/** Short-lived (60s) signed URL. Admin-only storage policy also enforces this in the DB. */
export async function getReceiptUrl(path: string): Promise<{ url: string } | { error: true }> {
  if (!(await isAdmin())) return { error: true };
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, RECEIPT_URL_TTL_SECONDS);
  if (error || !data) return { error: true };
  return { url: data.signedUrl };
}

export type DecideResult = { ok: true; receiptDeleted: boolean } | { ok: false; error: "already" | "duplicate" | "reason" | "failed" };

/** Approve/reject, then delete the receipt file and mark it deleted. A failed delete is retryable. */
export async function decide(id: string, decision: "approved" | "rejected", reason: string | null): Promise<DecideResult> {
  if (!(await isAdmin())) return { ok: false, error: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_course_purchase", { p_id: id, p_decision: decision, p_reason: reason });
  if (error) {
    const e = error.code === "55000" ? "already" : error.code === "23505" ? "duplicate" : error.code === "22023" ? "reason" : "failed";
    return { ok: false, error: e };
  }
  const deleted = await removeReceipt(id, (data as { receipt_path: string | null }).receipt_path);
  revalidatePath("/admin/payments");
  return { ok: true, receiptDeleted: deleted };
}

async function removeReceipt(id: string, path: string | null): Promise<boolean> {
  const supabase = await createClient();
  if (path) {
    const { error } = await supabase.storage.from("receipts").remove([path]);
    if (error) return false;
  }
  const { error } = await supabase.rpc("mark_receipt_deleted", { p_id: id });
  return !error;
}

export async function retryDelete(id: string, path: string): Promise<{ ok: boolean }> {
  if (!(await isAdmin())) return { ok: false };
  const ok = await removeReceipt(id, path);
  revalidatePath("/admin/payments");
  return { ok };
}
