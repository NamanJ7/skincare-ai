import { Share } from "react-native";

import { readLocalAnalyticsEvents } from "./analytics-outbox";

/** User-initiated export for measured TestFlight cohorts before a remote sink. */
export async function shareBetaMetrics(): Promise<number> {
  const events = await readLocalAnalyticsEvents();
  await Share.share({
    title: "Pore diagnostics",
    message: JSON.stringify(
      {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        privacy: "No photos, emails, free text, product names, or skin observations",
        events,
      },
      null,
      2,
    ),
  });
  return events.length;
}
