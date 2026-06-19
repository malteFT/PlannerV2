"use client";

import * as React from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { useArchivedPlans } from "@/lib/queries/plans";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function HistoryPage() {
  const query = useArchivedPlans();
  const plans = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historie"
        description="Frühere Pläne (archiviert)."
      />

      {query.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {query.isError && (
        <p className="text-sm text-destructive">
          Fehler:{" "}
          {query.error instanceof Error ? query.error.message : "Unbekannt"}
        </p>
      )}

      {!query.isLoading && !query.isError && plans.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Calendar className="size-8" />
            <p>Noch keine archivierten Pläne.</p>
          </CardContent>
        </Card>
      )}

      {plans.length > 0 && (
        <div className="space-y-3">
          {plans.map((p) => (
            <Link
              key={p.id}
              href={`/history/${p.id}`}
              className="card-interactive block rounded-lg"
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      {p.name ?? `Plan vom ${formatDate(p.activated_at ?? p.created_at)}`}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.activated_at)} – {formatDate(p.archived_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                    <Badge variant="secondary">{p.day_count} Tage</Badge>
                    <span>{p.target_kcal_per_day} kcal/Tag</span>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
