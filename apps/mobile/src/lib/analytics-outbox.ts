import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  setAnalyticsSink,
  type AnalyticsPayload,
  type AnalyticsSink,
} from "./analytics";

const KEY = "pore/analytics-outbox";
const VERSION = 1;
export const MAX_ANALYTICS_EVENTS = 500;

interface AnalyticsEnvelope {
  v: typeof VERSION;
  events: AnalyticsPayload[];
}

export function appendToAnalyticsOutbox(
  current: AnalyticsPayload[],
  next: AnalyticsPayload,
  limit = MAX_ANALYTICS_EVENTS,
): AnalyticsPayload[] {
  return [...current, next].slice(-Math.max(1, limit));
}

async function readEnvelope(): Promise<AnalyticsEnvelope> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { v: VERSION, events: [] };
    const parsed = JSON.parse(raw) as Partial<AnalyticsEnvelope>;
    if (parsed.v !== VERSION || !Array.isArray(parsed.events)) {
      return { v: VERSION, events: [] };
    }
    return { v: VERSION, events: parsed.events.slice(-MAX_ANALYTICS_EVENTS) };
  } catch {
    return { v: VERSION, events: [] };
  }
}

let writes = Promise.resolve();

/**
 * Local beta sink. It makes the funnel inspectable before a remote analytics
 * provider is selected, while keeping the same privacy-safe payload contract.
 */
export const localAnalyticsSink: AnalyticsSink = (payload) => {
  writes = writes.then(async () => {
    const envelope = await readEnvelope();
    const next: AnalyticsEnvelope = {
      v: VERSION,
      events: appendToAnalyticsOutbox(envelope.events, payload),
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }).catch(() => {});
  return writes;
};

export function installLocalAnalyticsSink(): () => void {
  setAnalyticsSink(localAnalyticsSink);
  return () => setAnalyticsSink(undefined);
}

export async function readLocalAnalyticsEvents(): Promise<AnalyticsPayload[]> {
  return (await readEnvelope()).events;
}

export async function clearLocalAnalyticsEvents(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Analytics is observational and must not block the product flow.
  }
}
