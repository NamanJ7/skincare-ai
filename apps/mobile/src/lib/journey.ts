/**
 * Pure Skin Journey derivation. Every event is backed by persisted user
 * activity; this module never infers skin change, causality, or a combined score.
 */
import { daysBetween, type CheckInLog } from "./check-in";
import { periodComplete, type DateKey, type RoutineLog } from "./log";
import type { ScanHistory, ScanRecord } from "./scan-history";

export type JourneyLane = "behavior" | "observation" | "self_report";

export type JourneyEventKind =
  | "journey_start"
  | "routine_day"
  | "scan"
  | "check_in"
  | "routine_revision"
  | "milestone";

export interface JourneyEvent {
  id: string;
  date: DateKey;
  createdAt?: string;
  kind: JourneyEventKind;
  lane: JourneyLane;
  title: string;
  detail?: string;
  analyzed?: boolean;
  irritation?: boolean;
  photoName?: string;
}

export interface JourneySummary {
  startDate: DateKey | null;
  dayNumber: number | null;
  completedRoutineDays: number;
  events: JourneyEvent[];
}

export interface DeriveJourneyInput {
  log: RoutineLog;
  checkIns: CheckInLog;
  scans: ScanHistory;
  today: DateKey;
}

const EVENT_ORDER: Record<JourneyEventKind, number> = {
  journey_start: 0,
  routine_day: 1,
  scan: 2,
  check_in: 3,
  routine_revision: 4,
  milestone: 5,
};

function chronologicalScans(scans: ScanRecord[]): ScanRecord[] {
  return [...scans].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
}

function completedRoutineDates(log: RoutineLog): DateKey[] {
  return Object.entries(log.days)
    .filter(([, day]) => periodComplete(day.am) || periodComplete(day.pm))
    .map(([date]) => date)
    .sort();
}

function firstDate(input: DeriveJourneyInput): DateKey | null {
  const dates = [
    ...Object.keys(input.log.days),
    ...input.checkIns.entries.map((entry) => entry.date),
    ...input.scans.scans.map((scan) => scan.date),
    ...(input.log.revision ? [input.log.revision.effectiveDate] : []),
  ].sort();
  return dates[0] ?? null;
}

function compareEvents(a: JourneyEvent, b: JourneyEvent): number {
  return (
    a.date.localeCompare(b.date) ||
    EVENT_ORDER[a.kind] - EVENT_ORDER[b.kind] ||
    (a.createdAt ?? "").localeCompare(b.createdAt ?? "") ||
    a.id.localeCompare(b.id)
  );
}

function hasComparableRead(scan: ScanRecord): boolean {
  return (
    scan.analyzed === true &&
    (scan.findings !== undefined || scan.assessment !== undefined)
  );
}

export function deriveJourney(input: DeriveJourneyInput): JourneySummary {
  const startDate = firstDate(input);
  const routineDates = completedRoutineDates(input.log);
  const scans = chronologicalScans(input.scans.scans);
  const events: JourneyEvent[] = [];

  if (startDate) {
    events.push({
      id: `journey-start:${startDate}`,
      date: startDate,
      kind: "journey_start",
      lane: "behavior",
      title: "Journey started",
    });
  }

  for (const date of routineDates) {
    const day = input.log.days[date];
    const morning = periodComplete(day?.am);
    const evening = periodComplete(day?.pm);
    events.push({
      id: `routine-day:${date}`,
      date,
      kind: "routine_day",
      lane: "behavior",
      title: "Routine day completed",
      detail:
        morning && evening
          ? "Morning and evening routines were marked complete."
          : morning
            ? "Morning routine was marked complete."
            : "Evening routine was marked complete.",
    });
  }

  for (const [index, scan] of scans.entries()) {
    const analyzed = scan.analyzed === true;
    events.push({
      id: `scan:${scan.createdAt}`,
      date: scan.date,
      createdAt: scan.createdAt,
      kind: "scan",
      lane: "observation",
      title:
        index === 0
          ? analyzed
            ? "First scan analyzed"
            : "First scan saved"
          : analyzed
            ? "Scan analyzed"
            : "Scan saved",
      detail: analyzed
        ? "Photos were saved and analyzed."
        : "Photos were saved, but this scan was not analyzed.",
      analyzed,
      ...(scan.photoNames[0] ? { photoName: scan.photoNames[0] } : {}),
    });
  }

  for (const entry of input.checkIns.entries) {
    const irritation = entry.irritationSigns.length > 0;
    events.push({
      id: `check-in:${entry.date}:${entry.createdAt}`,
      date: entry.date,
      createdAt: entry.createdAt,
      kind: "check_in",
      lane: "self_report",
      title: "Check-in completed",
      detail: irritation
        ? "You reported irritation or discomfort at this check-in."
        : "Your skin experience was recorded.",
      irritation,
      ...(entry.photoName ? { photoName: entry.photoName } : {}),
    });
  }

  if (input.log.revision) {
    events.push({
      id: `routine-revision:${input.log.revision.acceptedAt}`,
      date: input.log.revision.effectiveDate,
      createdAt: input.log.revision.acceptedAt,
      kind: "routine_revision",
      lane: "behavior",
      title: "Routine adjusted",
      detail: input.log.revision.reason,
    });
  }

  const seventhRoutineDate = routineDates[6];
  if (seventhRoutineDate) {
    events.push({
      id: `milestone:seven-routine-days:${seventhRoutineDate}`,
      date: seventhRoutineDate,
      kind: "milestone",
      lane: "behavior",
      title: "Seven routine days completed",
    });
  }

  const analyzedScans = scans.filter(hasComparableRead);
  const comparisonScan = analyzedScans[1];
  if (comparisonScan) {
    events.push({
      id: `milestone:first-comparison:${comparisonScan.createdAt}`,
      date: comparisonScan.date,
      createdAt: comparisonScan.createdAt,
      kind: "milestone",
      lane: "observation",
      title: "First comparison available",
      detail: "Two analyzed scans are available to compare.",
      analyzed: true,
    });
  }

  events.sort(compareEvents);

  return {
    startDate,
    dayNumber: startDate
      ? Math.max(1, daysBetween(startDate, input.today) + 1)
      : null,
    completedRoutineDays: routineDates.length,
    events,
  };
}
