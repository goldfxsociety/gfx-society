import Link from "next/link";
import { APPROVAL_TIME, CONTACT_EMAIL, STATUS_SURFACE_NOTE } from "@/config/training";
import { getAllCourseViews } from "@/lib/training/courses";
import { formatPht } from "@/lib/training/time";
import { GraceBanner } from "@/components/training/grace-banner";
import { Chip } from "@/components/training/chip";

/** Payment status surface (no email updates yet). Members only; non-members see nothing. */
export async function MyCourses() {
  const { membership, views } = await getAllCourseViews();
  if (membership === "none") return null;
  const grace = membership === "grace";
  const rows = views.filter((v) => ["free_new", "free_progress", "free_done", "pending", "rejected", "owned"].includes(v.state));
  return (
    <>
    {grace && <GraceBanner />}
    <section aria-labelledby="my-courses-h" className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 id="my-courses-h" className="text-lg font-semibold">My courses</h2>
      <p className="text-sm text-muted-foreground">{STATUS_SURFACE_NOTE}</p>
      {rows.length === 0 ? (
        <p className="text-sm">
          Wala ka pang course. <Link href="/courses" className="underline">Tingnan ang courses</Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((v) => (
            <li key={v.catalog.slug} className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/courses/${v.catalog.slug}`} className="font-medium underline">
                  {v.catalog.title}
                </Link>
                {v.state === "pending" ? (
                  <Chip tone="amber">Pending review</Chip>
                ) : v.state === "rejected" ? (
                  <Chip tone="red">Needs re-upload</Chip>
                ) : v.state === "owned" ? (
                  <Chip tone="green">Unlocked</Chip>
                ) : (
                  <Chip tone="gold">Free</Chip>
                )}
              </div>
              {v.pay.payment_code && v.state !== "owned" && !v.state.startsWith("free") && (
                <p className="text-muted-foreground">
                  Ref {v.pay.payment_code}
                  {v.pay.submitted_at ? ` · submitted ${formatPht(v.pay.submitted_at)}` : ""}
                </p>
              )}
              {v.state === "pending" && <p>Ive-verify ni GFX within {APPROVAL_TIME}.</p>}
              {v.state === "rejected" && (
                <>
                  <p>
                    Hindi na-approve{v.pay.reject_reason ? <>: <strong>{v.pay.reject_reason}</strong></> : null}. Puwede kang mag-upload ulit
                    gamit ang parehong GFX reference code. Kung may tanong, email {CONTACT_EMAIL}.
                  </p>
                  <Link href={`/courses/${v.catalog.slug}/pay`} className="inline-flex min-h-11 items-center underline">
                    Re-upload receipt →
                  </Link>
                </>
              )}
              {v.lessons.length > 0 && (
                <p className="text-muted-foreground">
                  {v.done} of {v.lessons.length} lessons
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
    </>
  );
}
