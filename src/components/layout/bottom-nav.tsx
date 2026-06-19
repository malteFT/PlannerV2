"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

// Bottom-Nav-Items: 4 Kern + "Mehr" als 5. Slot.
// Mehr öffnet ein Bottom-Sheet mit den restlichen Routen.
const BOTTOM_PRIMARY = ["/plan", "/shopping", "/inventory", "/recipes"] as const;
const MORE_HREFS = new Set<string>([
  "/ingredients",
  "/history",
  "/settings",
]);

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const primaryItems = BOTTOM_PRIMARY.map((href) =>
    NAV_ITEMS.find((i) => i.href === href),
  ).filter(Boolean) as Array<(typeof NAV_ITEMS)[number]>;

  const moreItems = NAV_ITEMS.filter((i) => MORE_HREFS.has(i.href));

  // "Mehr" gilt als aktiv, wenn man auf einer der versteckten Routen ist.
  const moreActive = moreItems.some(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );

  return (
    <>
      <nav
        aria-label="Hauptnavigation"
        className={cn(
          "md:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-card",
          "safe-bottom",
        )}
      >
        <ul className="grid grid-cols-5">
          {primaryItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "touch-target flex flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium",
                    "transition-colors duration-150 ease-out",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-[22px]" aria-hidden />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                "touch-target flex w-full flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium",
                "transition-colors duration-150 ease-out",
                moreActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MoreHorizontal className="size-[22px]" aria-hidden />
              <span>Mehr</span>
            </button>
          </li>
        </ul>
      </nav>

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={moreItems}
        currentPath={pathname}
      />
    </>
  );
}

/**
 * Bottom-Sheet (Mobile-Drawer) für die zusätzlichen Routen.
 * Reines Tailwind statt einer neuen Lib — Dialog-Pattern via Portal nicht nötig,
 * weil wir nur ein einfaches Overlay + Slide-up brauchen.
 */
function MoreSheet({
  open,
  onClose,
  items,
  currentPath,
}: {
  open: boolean;
  onClose: () => void;
  items: ReadonlyArray<(typeof NAV_ITEMS)[number]>;
  currentPath: string;
}) {
  // ESC zum Schließen
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Body-Scroll-Lock, solange offen
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-50 bg-foreground/40 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mehr"
        className={cn(
          "md:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-card shadow-2xl",
          "transition-transform duration-250 ease-out",
          "safe-bottom",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* Drag-Handle (visual nur) */}
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" aria-hidden />
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-medium text-muted-foreground">Mehr</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="touch-target rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <ul className="flex flex-col gap-1 px-2 pb-4">
          {items.map(({ href, label, icon: Icon }) => {
            const active =
              currentPath === href || currentPath.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={onClose}
                  className={cn(
                    "touch-target flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium",
                    "transition-colors duration-150 ease-out",
                    active
                      ? "bg-accent text-foreground"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[20px]",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
