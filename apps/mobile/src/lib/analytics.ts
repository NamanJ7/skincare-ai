/**
 * Vendor-neutral product analytics.
 *
 * Events deliberately contain product context only: never email, notes,
 * product names, photos, or other health-adjacent user input. A future vendor
 * integration only needs to register a sink at app startup.
 */
export type AnalyticsEvent =
  | "app_opened"
  | "app_error"
  | "session_started"
  | "onboarding_started"
  | "onboarding_step_viewed"
  | "onboarding_step_completed"
  | "onboarding_step_backed_out"
  | "onboarding_completed"
  | "youth_consent_completed"
  | "notification_prompt_viewed"
  | "notification_opted_in"
  | "notification_skipped"
  | "reminder_permission_requested"
  | "reminder_permission_granted"
  | "reminder_permission_denied"
  | "reminder_scheduled"
  | "reminder_disabled"
  | "reminder_opened"
  | "routine_adjustment_shown"
  | "routine_adjustment_accepted"
  | "routine_adjustment_dismissed"
  | "scan_started"
  | "scan_guidance_ready"
  | "scan_capture_verified"
  | "scan_capture_rejected"
  | "scan_validation_completed"
  | "scan_completed"
  | "scan_deleted"
  | "scan_failed"
  | "analysis_completed"
  | "analysis_requested"
  | "analysis_failed"
  | "results_viewed"
  | "routine_viewed"
  | "routine_step_toggled"
  | "routine_period_completed"
  | "routine_session_started"
  | "routine_session_resumed"
  | "routine_session_step_completed"
  | "routine_session_step_skipped"
  | "routine_session_finished"
  | "routine_session_abandoned"
  | "check_in_started"
  | "check_in_completed"
  | "weekly_report_viewed"
  | "weekly_follow_up_unlocked"
  | "shelf_product_added"
  | "shelf_product_edited"
  | "product_search_started"
  | "product_search_selected"
  | "product_search_empty"
  | "compatibility_check_completed"
  | "compatibility_limit_reached"
  | "paywall_viewed"
  | "plus_interest_recorded"
  | "trial_started"
  | "paywall_intent_submitted"
  | "paywall_skipped"
  | "premium_feature_locked"
  | "account_upgrade_viewed"
  | "account_upgrade_completed"
  | "clarity_rating_submitted"
  | "feedback_opened"
  | "feedback_submitted"
  | "legal_document_viewed"
  | "account_deletion_requested"
  | "account_deletion_completed"
  | "purchase_started"
  | "purchase_completed"
  | "purchase_failed"
  | "purchase_restored";

type AnalyticsValue = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsValue | undefined>;

export interface AnalyticsPayload<E extends AnalyticsEvent = AnalyticsEvent> {
  name: E;
  occurredAt: string;
  properties: Record<string, AnalyticsValue>;
}

export type AnalyticsSink = (payload: AnalyticsPayload) => void | Promise<void>;

let sink: AnalyticsSink | undefined;

/** Register the eventual provider adapter. Calling again intentionally replaces it. */
export function setAnalyticsSink(next: AnalyticsSink | undefined): void {
  sink = next;
}

/**
 * Produces a stable, provider-ready payload. Undefined values are omitted so
 * dashboards do not receive a mix of missing and stringified values.
 */
export function shapeAnalyticsEvent<E extends AnalyticsEvent>(
  name: E,
  properties: AnalyticsProperties = {},
  occurredAt = new Date().toISOString(),
): AnalyticsPayload<E> {
  const clean: Record<string, AnalyticsValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value !== undefined) clean[key] = value;
  }
  return { name, occurredAt, properties: clean };
}

/** Fire-and-forget by design: analytics must never interrupt a user flow. */
export function track<E extends AnalyticsEvent>(
  name: E,
  properties?: AnalyticsProperties,
): void {
  const payload = shapeAnalyticsEvent(name, properties);
  try {
    Promise.resolve(sink?.(payload)).catch(() => {});
  } catch {
    // A provider adapter is observational only; keep the product flow safe.
  }
}
