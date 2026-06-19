"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

// Auf dem Handy zeigen wir nur die wichtigsten 5 Items in einer Bottom-Bar.
// Alles weitere wandert hinter ein "Mehr"-Menü, sobald wir es brauchen — für
// MVP belassen wir den Schnitt einfach: Plan / Einkauf / Vorrat / Rezepte / Settings.
const MOBILE_PRIORITY = new Set([
  "/plan",
  "/shopping",
  "/inventory",
  "/recipes",
  "/settings",
]);

export function BottomNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => MOBILE_PRIORITY.has(i.href));

  return (
    <nav className="md:hidden sticky bottom-0 z-10 grid grid-cols-5 border-t bg-card">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
