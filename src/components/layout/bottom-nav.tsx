"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

// Mobile-Bottom-Nav: alle Kern-Items (6).
// Historie ist über Plan → "Plan abschließen" zugänglich; alles andere direkt.
const MOBILE_PRIORITY = new Set([
  "/plan",
  "/shopping",
  "/inventory",
  "/recipes",
  "/ingredients",
  "/settings",
]);

export function BottomNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => MOBILE_PRIORITY.has(i.href));

  return (
    <nav
      aria-label="Hauptnavigation"
      className={cn(
        "md:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-card",
        "safe-bottom",
      )}
    >
      <ul className="grid grid-cols-6">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "touch-target flex flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium",
                  "transition-colors duration-150 ease-out",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-[20px]" aria-hidden />
                <span className="leading-tight">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
