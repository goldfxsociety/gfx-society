import Link from "next/link";
import { Home, BookOpen, UserRound } from "lucide-react";
import { ME } from "@/config/members-home";
import type { ModuleGroup } from "@/lib/training/courses";

type Active = "home" | "courses" | "account";
const ITEMS = [
  { key: "home", href: "/training", label: ME.nav.home, icon: Home },
  { key: "courses", href: "/courses", label: ME.nav.courses, icon: BookOpen },
  { key: "account", href: "/account", label: ME.nav.account, icon: UserRound },
] as const;

/**
 * Members-only nav (spec §3.3, §4, decision 1): Home · Courses · Account, Tools later.
 * Desktop: 220px left nav with Navigate / Modules of the current course / Tools (later).
 * <1024px: bottom tab bar (max 4). Rendering it hides the global Academy bottom nav (globals.css, [data-members-nav]).
 * Ideas and Chat are not in the nav (decision 4).
 */
export function MembersNav({
  active,
  course,
}: {
  active: Active;
  course?: { slug: string; title: string; modules: ModuleGroup[] };
}) {
  return (
    <>
      <aside data-members-nav className="hidden w-[220px] shrink-0 lg:block">
        <nav aria-label="Members" className="sticky top-20 flex flex-col gap-4 pt-10 text-sm">
          <div className="flex flex-col">
            <p className="px-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">{ME.nav.navigate}</p>
            {ITEMS.map(({ key, href, label, icon: Icon }) => (
              <Link
                key={key}
                href={href}
                aria-current={active === key ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-md px-2 ${active === key ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Link>
            ))}
          </div>
          {course && course.modules.length > 0 && (
            <div className="flex flex-col">
              <p className="px-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {ME.nav.modules} · {course.title}
              </p>
              {course.modules.map((m) => (
                <Link
                  key={m.sort}
                  href={`/courses/${course.slug}#mod-${m.sort}`}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-md px-2 text-muted-foreground hover:text-foreground"
                >
                  <span className="truncate">{m.title}</span>
                  <span className="text-xs">
                    {m.done}/{m.lessons.length}
                  </span>
                </Link>
              ))}
            </div>
          )}
          <p className="flex min-h-11 items-center px-2 text-muted-foreground">
            {ME.nav.tools} · {ME.nav.later}
          </p>
        </nav>
      </aside>
      <nav
        data-members-nav
        aria-label="Members"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-2xl items-stretch justify-between px-2">
          {ITEMS.map(({ key, href, label, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              aria-current={active === key ? "page" : undefined}
              className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-[11px] font-medium ${active === key ? "text-primary" : "text-muted-foreground"}`}
            >
              <Icon aria-hidden className="size-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
