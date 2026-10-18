"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signUpWithConsent } from "./actions";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [experienceLevel, setExperienceLevel] = useState("");
  // Both consent boxes are unticked by default (RA 10173). Never pre-tick.
  const [consentRequired, setConsentRequired] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consentRequired) {
      setError("I-check muna ang consent box para magawa ang account mo. (Please tick the required consent box.)");
      return;
    }
    setLoading(true);
    setError(null);

    const result = await signUpWithConsent({
      displayName,
      email,
      password,
      experienceLevel,
      consentRequired,
      consentMarketing,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (!result.needsEmailConfirmation) {
      // Email confirmation is off — the user is already logged in.
      // First visit after signup: welcome (not "welcome back") + Lesson 1 (logged-in audit #4).
      router.push("/?welcome=new");
      router.refresh();
    } else {
      // Email confirmation is required before the session is active.
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle><h1 className="text-lg font-semibold">Check your email</h1></CardTitle>
            <CardDescription>
              We sent a confirmation link to {email}. Click it to activate
              your account, then come back and log in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="inline-flex min-h-11 items-center text-sm underline">
              Go to login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle><h1 className="text-lg font-semibold">Create your GFX Society account</h1></CardTitle>
          <CardDescription>
            Free forever — this just saves your progress across devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">
                Name <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Juan dela Cruz"
                autoComplete="name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="experienceLevel">
                Trading experience <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <select
                id="experienceLevel"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="h-11 rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Pumili ng isa (optional)</option>
                <option value="never_traded">Never traded</option>
                <option value="demo_only">Demo only</option>
                <option value="trading_live">Trading live</option>
              </select>
            </div>
            <p className="-mb-2 text-sm font-semibold">
              <span className="mr-1 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">Required</span>
              18+ ako at agree ako sa Terms at Privacy Notice
            </p>
            <div className="flex items-start gap-3 text-sm leading-relaxed">
              <input
                id="consentRequired"
                type="checkbox"
                checked={consentRequired}
                onChange={(e) => setConsentRequired(e.target.checked)}
                required
                className="mt-0.5 h-6 w-6 shrink-0 accent-primary"
              />
              <label htmlFor="consentRequired">
                I am 18 or older, and I agree to the{" "}
                <Link href="/terms" className="-my-3 inline-block py-3 underline" target="_blank">Terms of Use</Link>{" "}
                and consent to GoldFX Society processing my name, email and
                experience level to create my account, give me Academy access,
                and send me the Starter Kit and GFX education emails, as
                described in the{" "}
                <Link href="/privacy" className="-my-3 inline-block py-3 underline" target="_blank">Privacy Notice</Link>.
                I can unsubscribe or withdraw consent anytime.
                <span className="mt-1 block text-muted-foreground">
                  Required ito para ma-create ang account mo at ma-send namin ang Starter Kit.
                </span>
              </label>
            </div>
            <p className="-mb-2 text-sm font-semibold">
              <span className="mr-1 rounded border border-border px-1.5 py-0.5 text-xs">Optional</span>
              Community news at updates (optional ito)
            </p>
            <div className="flex items-start gap-3 text-sm leading-relaxed">
              <input
                id="consentMarketing"
                type="checkbox"
                checked={consentMarketing}
                onChange={(e) => setConsentMarketing(e.target.checked)}
                className="mt-0.5 h-6 w-6 shrink-0 accent-primary"
              />
              <label htmlFor="consentMarketing">
                (Optional) Send me GFX Society community news, event invites
                and updates. I can unsubscribe anytime.
              </label>
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button
              type="submit"
              disabled={loading || !consentRequired}
              aria-describedby={!consentRequired ? "signup-disabled-reason" : undefined}
              className="h-12 w-full text-base"
            >
              {loading ? "Creating account..." : "Sign up"}
            </Button>
            {!consentRequired && (
              <p id="signup-disabled-reason" className="-mt-2 text-sm text-muted-foreground">
                I-check muna ang Required box para ma-create ang account mo.
              </p>
            )}
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            We use your data only as described in our{" "}
            <Link href="/privacy" className="-my-3.5 inline-block py-3.5 underline">Privacy Notice</Link>. We
            never sell your data or share it with brokers without your consent.
            Education only — not financial advice.{" "}
            <Link href="/risk" className="underline">Risk warning</Link>.
          </p>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="inline-flex min-h-11 items-center underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
