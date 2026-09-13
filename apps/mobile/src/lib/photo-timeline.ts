/**
 * Unified progress-photo timeline: scan front shots + optional check-in
 * photos, merged ascending. Pure, no React — stored names resolve to URIs at
 * render time via photos.ts photoUri(), never persisted as absolute paths.
 */
import { daysBetween, type CheckInLog } from "./check-in";
import type { DateKey } from "./log";
import type { ScanHistory } from "./scan-history";

export interface TimelineEntry {
  date: DateKey;
  createdAt: string;
  /** Relative name under photos/ — resolve with photoUri() at render. */
  photoName: string;
  source: "scan" | "check_in";
}

/** Merged photo entries, oldest → newest; entries without photos drop out. */
export function photoTimeline(
  scans: ScanHistory,
  checkIns: CheckInLog,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const scan of scans.scans) {
    // Always the front shot — check-in photos are single-angle, so comparing
    // front-to-front keeps the timeline honest.
    const frontPhoto = scan.photoNames.find((name) =>
      /-front\.[a-z0-9]+$/i.test(name),
    );
    if (frontPhoto) {
      entries.push({
        date: scan.date,
        createdAt: scan.createdAt,
        photoName: frontPhoto,
        source: "scan",
      });
    }
  }
  for (const entry of checkIns.entries) {
    if (entry.photoName) {
      entries.push({
        date: entry.date,
        createdAt: entry.createdAt,
        photoName: entry.photoName,
        source: "check_in",
      });
    }
  }
  entries.sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );
  return entries;
}

/** "Day 1" for the baseline, then Day N / Week N / Month N relative to it. */
export function timelineLabel(
  baseline: TimelineEntry,
  entry: TimelineEntry,
): string {
  const d = daysBetween(baseline.date, entry.date);
  if (d <= 0) return "Day 1";
  if (d < 7) return `Day ${d + 1}`;
  if (d < 28) return `Week ${Math.round(d / 7)}`;
  return `Month ${Math.round(d / 30)}`;
}
