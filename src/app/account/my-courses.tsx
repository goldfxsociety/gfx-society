import Link from "next/link";
import { APPROVAL_TIME, CONTACT_EMAIL, STATUS_SURFACE_NOTE, BOUGHT_STAY_OPEN_NOTE } from "@/config/training";
import { getAllCourseViews } from "@/lib/training/courses";
import { formatPht } from "@/lib/training/time";
import { GraceBanner } from "@/components/training/grace-banner";
import { Chip } from "@/components/training/chip";

/** Payment status surface (no email updates yet). Linked members, consented Explorers (Gold Reset) and S8 owners. */
export async function MyCourses() {
  const { membership, views } = await getAllCourseViews();
  const grace = membership === "grace";
  const rows = views.filter((v) => ["free_new", "free_progress", "free_done", "pending", "rejected", "owned"].includes(v.state));
  // S8 = A: a removed member with no bought course sees nothing here; with one, only the owned rows.
  // Sprint 3: a consented Explorer also sees Gold Reset here as a free course (not as a member perk), so the
  // "bought courses stay open" note is only for someone who actually owns a course.
  if (membership === "none" && rows.length === 0) return null;
  const removed = membership === "none" && rows.some((v) => v.state === "owned");
  return (
    <>
    {grace && <GraceBanner />}
    {removed && (
      <p role="status" className="rounded-lg border border-border p-3 text-sm">
        {BOUGHT_STAY_OPEN_NOTE}
      </p>
    )}
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
