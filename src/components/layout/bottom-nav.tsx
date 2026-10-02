"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, GraduationCap, BookOpen, Users, LayoutDashboard } from "lucide-react";
import { cn } from "cn";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/academy", label: "Academy", icon: GraduationCap },
  { href: "/resources", label: "Resources", icon: BookOpen },
  { href: "/community", label: "Community", icon: Users },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-stretch justify-between px-2">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
