import { cn } from "@/lib/utils";

/**
 * Skeleton-Loader-Block. Standard für Lade-Zustände statt Spinner.
 *
 * Nutzung:
 *   <Skeleton className="h-8 w-48" />
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}
