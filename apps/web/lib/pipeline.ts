/**
 * The Pore AI pipeline (server-only).
 *
 *   photo(s) + intake
 *     -> Claude vision call  -> structured Assessment (cosmetic, never diagnostic)
 *     -> Claude routine call -> draft Routine
 *     -> deterministic safety engine (@pore/shared) -> final Routine + adjustments
 *
 * Falls back to a deterministic mock when ANTHROPIC_API_KEY is unset, so the
 * whole flow works before a key is configured. Structured outputs are omitted
 * `thinking` on purpose: output_config.format already constrains the response to
 * schema-valid JSON, which is the most reliable path for the parse helper.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  applySafetyRules,
  type Assessment,
  type IntakeResponse,
  type PhotoQuality,
  type Routine,
  type SafetyAdjustment,
} from "@pore/shared";
import { AssessmentSchema, RoutineDraftSchema, normalizeDraft } from "./schemas";
import { ASSESSMENT_SYSTEM, ROUTINE_SYSTEM } from "./prompts";
import { draftRoutine, mockAssessment } from "./mock";

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export interface PlanImage {
  /** base64-encoded image bytes (no data: prefix). */
  data: string;
  mediaType?: ImageMediaType;
  /**
   * What the on-device capture gate measured for this shot. Optional so older
   * clients keep working, but when present it is put in front of the image so
   * the model can weight what it is looking at.
   */
  quality?: PhotoQuality;
}

export interface PlanInput {
  images: PlanImage[];
  intake: IntakeResponse;
}

export interface PlanResult {
  assessment: Assessment;
  routine: Routine;
  adjustments: SafetyAdjustment[];
  mode: "ai" | "mock";
}

const MODEL = "claude-opus-4-8";

/**
 * The model declined the request rather than failing.
 *
 * Distinguished from a server error so the caller can say something true: a
 * refusal surfaced as a 500 reads to the user as "we're broken" when the honest
 * answer is "we won't read this one".
 */
export class PlanRefusedError extends Error {
  constructor(readonly category: string | null) {
    super("The model declined to assess these photos");
    this.name = "PlanRefusedError";
  }
}

export async function generatePlan(input: PlanInput): Promise<PlanResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const photoQuality = input.images
    .slice(0, 3)
    .map((img) => img.quality)
    .filter((q): q is PhotoQuality => q !== undefined);

  if (!apiKey) {
    // A development convenience, and a production hazard if it goes unnoticed:
    // the findings below are invented. `mode: "mock"` is the contract that says
    // so, and clients MUST branch on it — a deploy that is merely missing its
    // key would otherwise show someone fabricated findings about their face.
    console.warn(
      "[/api/plan] ANTHROPIC_API_KEY is unset — returning a MOCK plan. " +
        "Findings are fabricated. This must never be a production configuration.",
    );
    const assessment = mockAssessment(input.intake, photoQuality);
    const { routine, adjustments } = applySafetyRules(draftRoutine(input.intake), input.intake);
    return { assessment, routine, adjustments, mode: "mock" };
  }

  const client = new Anthropic({ apiKey });

  // 1. Vision assessment — structured, cosmetic-only.
  //
  // Each image is preceded by a text block naming its angle, illuminant and
  // measured quality. Handing the model three anonymous photos and hoping it
  // infers which is which is how a finding ends up attached to the wrong side
  // of a face.
  const photos = input.images.slice(0, 3);
  const imageBlocks = photos.flatMap((img, i) => {
    const q = img.quality;
    const light = q?.illuminant === "screen_flash" ? "screen flash (controlled light)" : "ambient light";
    const label = q
      ? `Photo ${i + 1} of ${photos.length} — ${q.angle}, ${light}, capture quality ${q.score.toFixed(2)}` +
        (q.flags.length ? `, flagged: ${q.flags.join(", ")}` : "")
      : `Photo ${i + 1} of ${photos.length} — angle not recorded`;
    return [
      { type: "text" as const, text: label },
      {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: img.mediaType ?? "image/jpeg",
          data: img.data,
        },
      },
    ];
  });

  const assessmentResp = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: ASSESSMENT_SYSTEM,
    output_config: { format: zodOutputFormat(AssessmentSchema) },
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text", text: `User intake:\n${JSON.stringify(input.intake, null, 2)}` },
        ],
      },
    ],
  });
  // A safety classifier declining is not a server fault, and face photos are
  // exactly the input class where it can happen. `stop_details` is populated
  // only on refusal, so it is guarded rather than read blindly.
  if (assessmentResp.stop_reason === "refusal") {
    throw new PlanRefusedError(assessmentResp.stop_details?.category ?? null);
  }
  const parsed = assessmentResp.parsed_output;
  if (!parsed) throw new Error("Assessment did not return structured output");
  // photoQuality is measured on the device, not by the model — attach it here
  // rather than asking Claude to echo our own numbers back to us.
  const assessment: Assessment = { ...parsed, photoQuality };

  // 2. Routine draft from assessment + intake.
  const routineResp = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: ROUTINE_SYSTEM,
    output_config: { format: zodOutputFormat(RoutineDraftSchema) },
    messages: [
      {
        role: "user",
        content: `Assessment:\n${JSON.stringify(assessment)}\n\nIntake:\n${JSON.stringify(input.intake)}`,
      },
    ],
  });
  if (routineResp.stop_reason === "refusal") {
    throw new PlanRefusedError(routineResp.stop_details?.category ?? null);
  }
  const draft = routineResp.parsed_output;
  if (!draft) throw new Error("Routine did not return structured output");

  // 3. Deterministic safety clamp — the non-negotiable guarantees live here.
  const { routine, adjustments } = applySafetyRules(normalizeDraft(draft), input.intake);

  return { assessment, routine, adjustments, mode: "ai" };
}
