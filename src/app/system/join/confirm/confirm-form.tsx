"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { REQUEST_COPY as R } from "@/content/access-request";
import { JOIN_COPY as C } from "@/content/members-gate";
import { cn } from "@/lib/utils";
import { confirmAccm, type ConfirmState } from "./actions";

const KEY = "gfx_accm_confirm";
const TOKEN_RE = /^[0-9a-f]{64}$/;
/** Back here after login. The token is kept only in this tab's sessionStorage, never in the login URL. */
const LOGIN_HREF = "/login?next=%2Fsystem%2Fjoin%2Fconfirm";

/** Reads #token= once, moves it to sessionStorage (same tab, survives the login round trip), strips it from the URL. */
function takeToken(): string | null {
  const m = /(?:^#|&)token=([0-9a-f]{64})(?:&|$)/.exec(window.location.hash);
  if (m) {
    try {
      sessionStorage.setItem(KEY, m[1]);
    } catch {}
    window.history.replaceState(null, "", window.location.pathname);
    return m[1];
  }
  try {
    const t = sessionStorage.getItem(KEY);
    return t && TOKEN_RE.test(t) ? t : null;
  } catch {
    return null;
  }
}

export function ConfirmForm({ loggedIn }: { loggedIn: boolean }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmAccm, { result: "idle" });

  useEffect(() => {
    // Client-only: the fragment never reaches the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(takeToken());
  }, []);
  useEffect(() => {
    if (state.result === "confirmed" || state.result === "invalid") {
      try {
        sessionStorage.removeItem(KEY);
      } catch {}
    }
  }, [state.result]);

  if (token === undefined) return null;
  if (state.result === "confirmed") return <p role="status" className="text-sm leading-relaxed">{R.confirmedLanding}</p>;
  if (!token || state.result === "invalid") return <p role="status" className="text-sm leading-relaxed">{R.confirmInvalid}</p>;
  if (!loggedIn || state.result === "login_required")
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed">{R.confirmLoginBody}</p>
        <Link href={LOGIN_HREF} className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}>
          {C.loginCta}
        </Link>
      </div>
    );
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed">{R.confirmPrompt}</p>
      <input type="hidden" name="token" value={token} />
      <Button type="submit" disabled={pending} className="h-11 w-full">
        {R.confirmButton}
      </Button>
    </form>
  );
}
