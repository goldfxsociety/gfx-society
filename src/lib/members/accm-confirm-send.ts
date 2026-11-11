import nodemailer from "nodemailer";
import { SITE_URL } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACCM_CONFIRM_MAIL_LIVE } from "./access-request";
import { GMAIL_SMTP, SMTP_TIMEOUTS, readMailConfig, sendAccmConfirm, type SendResult } from "./accm-confirm-mail";

/**
 * Server-only wiring for the ACCM confirmation mail. Called from the /system/join request server action with the
 * user id from the server-verified session (supabase.auth.getUser()), never a client-supplied id.
 *
 * Service-role dependency (PR note): the token is issued by public.issue_accm_confirm_token, which is service_role
 * only on purpose (a user must never be able to read or set their own token, or they could confirm without inbox
 * access). So this path uses createAdminClient() (SUPABASE_SERVICE_ROLE_KEY on Vercel), like the purge cron.
 * Needs a hosted check of that key before go-live.
 */
export async function sendAccmConfirmForUser(userId: string): Promise<SendResult> {
  if (!ACCM_CONFIRM_MAIL_LIVE) return "error"; // flag off: no env read, no token, no mail
  const config = readMailConfig(process.env);
  const admin = config ? createAdminClient() : null;
  if (config && !admin) {
    console.error("[system/join] accm confirm mail", { code: "admin_env_missing" });
    return "error";
  }
  return sendAccmConfirm({
    config,
    siteUrl: SITE_URL,
    issueToken: async () => {
      const { data, error } = await admin!.rpc("issue_accm_confirm_token", { p_user_id: userId });
      if (error) {
        console.error("[system/join] issue_accm_confirm_token failed", { code: error.code });
        return null;
      }
      return (data ?? null) as { email?: unknown; token?: unknown; error?: unknown } | null;
    },
    send: async (msg) => {
      const transport = nodemailer.createTransport({ ...GMAIL_SMTP, ...SMTP_TIMEOUTS, auth: { user: config!.user, pass: config!.pass } });
      await transport.sendMail(msg);
    },
  });
}
