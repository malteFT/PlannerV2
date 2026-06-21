"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Tab-Auto-Refresh: bei jedem Seitenwechsel und beim Zurückkehren
        // zum Tab werden die Daten neu geholt. So sieht der User nach z.B.
        // einer Zutaten-Mutation in einem anderen Tab/Subseite die Änderung
        // beim Zurückwechseln ohne manuellen Reload.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnMount: "always",
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(getQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
