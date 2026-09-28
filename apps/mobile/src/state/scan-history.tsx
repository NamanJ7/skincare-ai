/** Persisted scan history for the progress photo timeline. */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import {
  addScan,
  emptyScans,
  latestScan,
  normalizeScans,
  removeScan,
  type ScanHistory,
  type ScanRecord,
} from "@/lib/scan-history";
import { remove, save } from "@/lib/storage";
import { deletePhotos } from "@/lib/photos";

interface ScanHistoryContextValue {
  history: ScanHistory;
  add: (record: ScanRecord) => void;
  remove: (createdAt: string) => void;
  latest: ScanRecord | undefined;
  clear: () => void;
}

const ScanHistoryContext = createContext<ScanHistoryContextValue | null>(null);

export function ScanHistoryProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: ScanHistory;
}) {
  // Storage and the cloud restore both hand back whatever was written by an
  // older build; normalize before it reaches `scans.filter(...)` on first render.
  const [history, setHistory] = useState<ScanHistory>(() =>
    initial ? normalizeScans(initial) : emptyScans(),
  );

  const value = useMemo<ScanHistoryContextValue>(
    () => ({
      history,
      add: (record) =>
        setHistory((prev) => {
          const next = addScan(prev, record);
          save("scans", next);
          return next;
        }),
      remove: (createdAt) => {
        // Deleting the files happens here, not inside the updater: React may
        // invoke an updater twice or discard the render, and this delete is
        // irreversible.
        const record = history.scans.find((scan) => scan.createdAt === createdAt);
        if (record) deletePhotos(record.photoNames);
        setHistory((prev) => {
          const next = removeScan(prev, createdAt);
          save("scans", next);
          return next;
        });
      },
      latest: latestScan(history),
      clear: () => {
        remove("scans");
        setHistory(emptyScans());
      },
    }),
    [history],
  );

  return <ScanHistoryContext.Provider value={value}>{children}</ScanHistoryContext.Provider>;
}

export function useScanHistory(): ScanHistoryContextValue {
  const ctx = useContext(ScanHistoryContext);
  if (!ctx) throw new Error("useScanHistory must be used within a ScanHistoryProvider");
  return ctx;
}
