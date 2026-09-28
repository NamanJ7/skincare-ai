/**
 * The Pore AI pipeline (server-only).
 *
 *   photo(s) + intake
 *     -> Claude vision call  -> structured Assessment (cosmetic, never diagnostic)
 *     -> Claude routine call -> draft Routine
 *     -> deterministic safety engine (@pore/shared) -> final Routine + adjustments
 *
 * Scan analysis is deliberately fail-closed. A scan is never replaced by a
 * deterministic, cached, or questionnaire-derived assessment when the vision
 * service is unavailable. Structured outputs omit `thinking` on purpose:
 * output_config.format already constrains the response to schema-valid JSON.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { applyAssessmentRoutinePolicy, applyIntakePreferences, applySafetyRules, type Assessment, type IntakeResponse, type Routine, type SafetyAdjustment } from "@pore/shared";
import {
  AssessmentSchema,
  RoutineDraftSchema,
  normalizeAssessment,
  normalizeDraft,
} from "./schemas";
import { ASSESSMENT_SYSTEM, ROUTINE_SYSTEM } from "./prompts";
import { AnalysisRequestError, assertBoundAnalysisInput } from "./scan-analysis-guard";
import {
  applyConfidenceLimits,
  captureConditions,
  describeCaptureConditions,
} from "./capture-conditions";
import type { ScanSession, StepId } from "@pore/shared/scan";

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export interface PlanImage {
  /** base64-encoded image bytes (no data: prefix). */
  data: string;
  mediaType?: ImageMediaType;
  stepId: StepId;
  captureId: string;
  /** SHA-256 of the decoded bytes in `data`. */
  contentDigest: string;
}

export interface PlanInput {
  images: PlanImage[];
  intake: IntakeResponse;
  scanSession: ScanSession;
  /** Aborts both model calls when the caller goes away (`req.signal`). */
  signal?: AbortSignal;
}

export interface PlanResult {
  assessment: Assessment;
  routine: Routine;
  adjustments: SafetyAdjustment[];
  mode: "ai";
}

const MODEL = "claude-opus-5";

/**
 * Covers thinking *plus* the response object. Adaptive thinking is on by
 * default on this model, so a budget sized only for the JSON truncates
 * mid-object — which surfaces as a schema violation rather than as a length
 * error, and would spend the repair retry on a problem no retry can fix.
 */
const MAX_TOKENS = 32_000;

/**
 * Wall-clock budget shared by both model calls. The SDK defaults to a 600 s
 * timeout with 2 retries *and retries timeouts*, so two sequential calls can
 * hold a Node handler — and keep billing — for the better part of an hour after
 * the caller has given up. `maxDuration` only bounds this on Vercel; nothing
 * bounds it under `next start`. Sits under the mobile client's own 55 s abort
 * (apps/mobile/src/lib/api.ts) so the user gets a clean "took too long".
 */
const TOTAL_BUDGET_MS = 50_000;
/** Leave the routine call a usable share even if the vision call runs long. */
const MIN_CALL_BUDGET_MS = 5_000;

/** An abort/timeout from either the deadline or the caller disconnecting. */
function isAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.name === "TimeoutError" ||
      error.name === "APIUserAbortError" ||
      error.name === "APIConnectionTimeoutError")
  );
}

function isRateLimit(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { status?: number }).status === 429
  );
}

/**
 * Opt in to server-side recovery when a safety classifier declines the request.
 *
 * Opus 5 ships elevated safeguards and can decline (HTTP 200,
 * `stop_reason: "refusal"`) on benign input; a guided face photo is exactly the
 * kind of bio-adjacent content that occasionally trips a false positive. With
 * `fallbacks: "default"` the API re-runs the declined request on a fallback
 * model server-side and routes by refusal category, so a false positive costs
 * a few seconds instead of silently demoting the user to an answers-only plan.
 */
const REFUSAL_FALLBACK_BETA = "server-side-fallback-2026-07-01";

/**
 * A 400 naming the fallback parameter is a statement about the deployment, not
 * about the response, so it must not be spent as one of the two structured
 * attempts and must never fail a scan that would otherwise have succeeded.
 */
function isFallbackRejection(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ((error as { status?: number }).status !== 400) return false;
  return error instanceof Error && /fallback/i.test(error.message);
}

/** One corrective retry; a second identical failure is a real failure. */
const MAX_STRUCTURED_ATTEMPTS = 2;
/** The model needs the gist of what broke, not our whole schema. */
const MAX_REPAIR_DETAIL_CHARS = 600;

/**
 * The validation message is useful to the model and unsafe to the client: it
 * enumerates our internal schema. It is fed back into the retry and never
 * returned or logged to the caller.
 */
function repairDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_REPAIR_DETAIL_CHARS);
}

/**
 * Run a structured-output call, giving the model one chance to correct itself.
 *
 * Structured-output parsing *throws* rather than resolving null when the
 * response violates the schema, and the SDK's own `maxRetries` covers transport
 * failures only — so before this, a single stray value ended the whole scan.
 * Retrying with the validation error appended recovers the near-misses; a
 * second failure is treated as genuinely unusable output.
 *
 * Aborts and rate limits are never retried: the deadline is shared across both
 * model calls, and burning it on a doomed retry only turns a clean "took too
 * long" into a slower one.
 */
async function parseStructured<T>(
  call: (
    repair: string | null,
    useFallback: boolean,
  ) => Promise<{ parsed_output: T | null; stop_reason?: string | null }>,
  label: string,
): Promise<T> {
  let repair: string | null = null;
  let useFallback = true;
  let attempt = 0;

  while (attempt < MAX_STRUCTURED_ATTEMPTS) {
    try {
      const response = await call(repair, useFallback);
      // Reaching here with a refusal means the fallback chain declined too, so
      // this is a permanent answer for these photos rather than a malformed
      // one. Retrying the identical images would only spend the budget.
      if (response.stop_reason === "refusal") {
        console.error(`${label} call was declined by a safety classifier`);
        throw new AnalysisRequestError(
          "Skin analysis could not run on these photos.",
          "ANALYSIS_DECLINED",
          422,
        );
      }
      if (response.parsed_output) return response.parsed_output;
      attempt += 1;
      repair = "Your previous response contained no structured object.";
    } catch (error) {
      if (error instanceof AnalysisRequestError) throw error;
      if (isAbort(error))
        throw new AnalysisRequestError(
          "Skin analysis took too long. Try again in a moment.",
          "ANALYSIS_TIMEOUT",
          504,
        );
      if (isRateLimit(error))
        throw new AnalysisRequestError(
          "Skin analysis is busy right now. Try again in a moment.",
          "ANALYSIS_BUSY",
          429,
        );
      if (useFallback && isFallbackRejection(error)) {
        // Losing refusal recovery is strictly better than losing the scan.
        console.warn(`${label}: refusal fallback unavailable, continuing without it`);
        useFallback = false;
        continue;
      }
      // Includes the Zod validation throw — detail stays server-side.
      attempt += 1;
      console.error(`${label} call failed (attempt ${attempt}):`, error);
      repair = `Your previous response failed validation: ${repairDetail(error)}`;
    }
  }

  throw new AnalysisRequestError(
    "Skin analysis could not be completed. Try again in a moment.",
    "ANALYSIS_INVALID_OUTPUT",
    502,
    // Which of the two model calls gave up is a pipeline-internal detail.
    `${label} did not return usable structured output`,
  );
}

/**
 * A corrective turn for a retry. Consecutive user messages are merged by the
 * API, so this appends cleanly without an assistant prefill (unsupported on
 * current models).
 */
function repairTurns(repair: string | null) {
  if (!repair) return [];
  return [
    {
      role: "user" as const,
      content: `${repair}\n\nReturn a corrected object that satisfies the required structure. Do not change your findings to make them fit; only fix the structure.`,
    },
  ];
}

/**
 * `fallbacks` and its beta header ship ahead of the SDK's typings. The wire
 * shape is stable, and `parseStructured` drops both if the deployment rejects
 * them, so the cast cannot cost a scan.
 */
function fallbackParams(useFallback: boolean): Record<string, unknown> {
  return useFallback ? { fallbacks: "default" } : {};
}

function callOptions(signal: AbortSignal, useFallback: boolean) {
  return useFallback
    ? { signal, headers: { "anthropic-beta": REFUSAL_FALLBACK_BETA } }
    : { signal };
}

export async function generatePlan(input: PlanInput): Promise<PlanResult> {
  // This server-side invariant is intentionally duplicated at the route and
  // session boundaries. The model must never be invoked with a partial scan.
  if (input.images.length !== 3 || input.images.some((image) => !image.data)) {
    throw new Error("A validated three-photo scan is required for analysis");
  }
  const validated = assertBoundAnalysisInput(input.scanSession, input.images);
  // Optics measured off these exact bytes. Already validated and digest-bound,
  // so this costs no extra trust surface — it was simply never being used.
  const conditions = captureConditions(validated);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    throw new AnalysisRequestError(
      "Skin analysis is unavailable because the vision service is not configured",
      "ANALYSIS_UNAVAILABLE",
      503,
    );

  // maxRetries 1, not the default 2: a retried timeout multiplies the wall clock
  // against a budget we have to keep.
  const client = new Anthropic({ apiKey, maxRetries: 1 });

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  /** Remaining budget, plus the caller's own signal so a disconnect cancels
   * the in-flight model call instead of leaving it running and billing. */
  const callSignal = (): AbortSignal => {
    const remaining = Math.max(MIN_CALL_BUDGET_MS, deadline - Date.now());
    const timeout = AbortSignal.timeout(remaining);
    return input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
  };

  // 1. Vision assessment — structured, cosmetic-only.
  const imageBlocks = input.images.flatMap((img) => [
    { type: "text" as const, text: `${img.stepId} quality-validated capture:` },
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: img.mediaType ?? "image/jpeg",
        data: img.data,
      },
    },
  ]);

  const conditionsBrief = describeCaptureConditions(conditions);

  const assessmentDraft = await parseStructured(
    (repair, useFallback) =>
      client.messages.parse(
        {
          ...fallbackParams(useFallback),
          model: MODEL,
          max_tokens: MAX_TOKENS,
          // Frozen rubric, identical on every scan and on the repair retry, so
          // it is worth caching across requests.
          system: [
            {
              type: "text" as const,
              text: ASSESSMENT_SYSTEM,
              cache_control: { type: "ephemeral" as const },
            },
          ],
          output_config: { format: zodOutputFormat(AssessmentSchema) },
          messages: [
            {
              role: "user",
              content: [
                ...imageBlocks,
                ...(conditionsBrief ? [{ type: "text" as const, text: conditionsBrief }] : []),
                { type: "text", text: `User intake:\n${JSON.stringify(input.intake, null, 2)}` },
              ],
            },
            ...repairTurns(repair),
          ],
        },
        callOptions(callSignal(), useFallback),
      ),
    "Assessment",
  );
  // Reconcile to the exact nine-concern contract before anything reads it, then
  // hold the model to what the optics and the three angles actually support.
  // This runs before the routine call so the routine is built on the clamped
  // numbers, not the model's original ones.
  const assessment = applyConfidenceLimits(
    normalizeAssessment(assessmentDraft),
    conditions,
  );

  // 2. Routine draft from assessment + intake.
  const draft = await parseStructured(
    (repair, useFallback) =>
      client.messages.parse(
        {
          ...fallbackParams(useFallback),
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: [
            {
              type: "text" as const,
              text: ROUTINE_SYSTEM,
              cache_control: { type: "ephemeral" as const },
            },
          ],
          output_config: { format: zodOutputFormat(RoutineDraftSchema) },
          messages: [
            {
              role: "user",
              content: `Assessment:\n${JSON.stringify(assessment)}\n\nIntake:\n${JSON.stringify(input.intake)}`,
            },
            ...repairTurns(repair),
          ],
        },
        callOptions(callSignal(), useFallback),
      ),
    "Routine",
  );

  // 3. Deterministic safety clamp — the non-negotiable guarantees live here.
  const safety = applySafetyRules(normalizeDraft(draft), input.intake);
  const evidenceBound = applyAssessmentRoutinePolicy(safety.routine, assessment);
  const personalized = applyIntakePreferences(evidenceBound.routine, input.intake);
  const routine = personalized.routine;
  const adjustments = [
    ...safety.adjustments,
    ...evidenceBound.adjustments,
    ...personalized.adjustments,
  ];

  return { assessment, routine, adjustments, mode: "ai" };
}
