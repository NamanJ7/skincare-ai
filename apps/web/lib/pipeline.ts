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
import { applySafetyRules, type Assessment, type IntakeResponse, type Routine, type SafetyAdjustment } from "@pore/shared";
import { AssessmentSchema, RoutineDraftSchema, normalizeDraft } from "./schemas";
import { ASSESSMENT_SYSTEM, ROUTINE_SYSTEM } from "./prompts";
import { draftRoutine, mockAssessment } from "./mock";

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export interface PlanImage {
  /** base64-encoded image bytes (no data: prefix). */
  data: string;
  mediaType?: ImageMediaType;
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

export async function generatePlan(input: PlanInput): Promise<PlanResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    const assessment = mockAssessment(input.intake);
    const { routine, adjustments } = applySafetyRules(draftRoutine(input.intake), input.intake);
    return { assessment, routine, adjustments, mode: "mock" };
  }

  const client = new Anthropic({ apiKey });

  // 1. Vision assessment — structured, cosmetic-only.
  const imageBlocks = input.images.slice(0, 3).map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: img.mediaType ?? "image/jpeg",
      data: img.data,
    },
  }));

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
  const assessment = assessmentResp.parsed_output;
  if (!assessment) throw new Error("Assessment did not return structured output");

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
  const draft = routineResp.parsed_output;
  if (!draft) throw new Error("Routine did not return structured output");

  // 3. Deterministic safety clamp — the non-negotiable guarantees live here.
  const { routine, adjustments } = applySafetyRules(normalizeDraft(draft), input.intake);

  return { assessment, routine, adjustments, mode: "ai" };
}
