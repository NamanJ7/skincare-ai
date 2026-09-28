import { describe, expect, it } from "vitest";

import {
  captureMachineReducer,
  countdownRemaining,
  COUNTDOWN_MS,
  createDamper,
  dampFeedback,
  FEEDBACK_HOLD_MS,
  initialCaptureState,
  isStable,
  pushStabilitySample,
  STABILITY_WINDOW_MS,
  STABLE_MS,
  type CaptureMachineState,
} from "../capture-machine";
import type { QualityVerdict } from "../types";

const good: QualityVerdict = { level: "good", code: "ok", readyForAutoCapture: true };
const drifting: QualityVerdict = { level: "acceptable", code: "out_of_frame", readyForAutoCapture: false };
const noFace: QualityVerdict = { level: "blocked", code: "no_face", readyForAutoCapture: false };

function frame(state: CaptureMachineState, now: number, verdict = good, stable = true) {
  return captureMachineReducer(state, { type: "FRAME", now, verdict, stable });
}

describe("capture machine — happy path to auto-capture", () => {
  it("walks searching → aligning → stabilizing → countdown → capturing", () => {
    let s = initialCaptureState;
    s = frame(s, 0, drifting, false);
    expect(s.phase).toBe("aligning");

    s = frame(s, 100, good, true);
    expect(s.phase).toBe("stabilizing");
    expect(s.goodSince).toBe(100);

    // Not stable long enough yet.
    s = frame(s, 100 + STABLE_MS - 1);
    expect(s.phase).toBe("stabilizing");

    s = frame(s, 100 + STABLE_MS);
    expect(s.phase).toBe("countdown");
    expect(s.countdownEndsAt).toBe(100 + STABLE_MS + COUNTDOWN_MS);

    s = frame(s, 100 + STABLE_MS + COUNTDOWN_MS);
    expect(s.phase).toBe("capturing");
  });

  it("stays in searching while no face", () => {
    let s = initialCaptureState;
    s = frame(s, 0, noFace, false);
    expect(s.phase).toBe("searching");
  });
});

describe("capture machine — cancellation", () => {
  it("collapses countdown back to aligning when quality degrades", () => {
    let s: CaptureMachineState = { phase: "countdown", goodSince: 0, countdownEndsAt: 3000 };
    s = frame(s, 1500, drifting);
    expect(s.phase).toBe("aligning");
    expect(s.countdownEndsAt).toBeNull();
  });

  it("resets stabilizing when the face becomes unstable", () => {
    let s: CaptureMachineState = { phase: "stabilizing", goodSince: 0, countdownEndsAt: null };
    s = frame(s, 500, good, false);
    expect(s.phase).toBe("aligning");
  });

  it("returns to searching when the face is lost during aligning", () => {
    let s: CaptureMachineState = { phase: "aligning", goodSince: null, countdownEndsAt: null };
    s = frame(s, 500, noFace);
    expect(s.phase).toBe("searching");
  });
});

describe("capture machine — manual shutter", () => {
  it.each(["searching", "aligning", "stabilizing", "countdown"] as const)(
    "rejects an unattested shutter press from %s",
    (phase) => {
      const before: CaptureMachineState = { phase, goodSince: null, countdownEndsAt: null };
      const s = captureMachineReducer(
        before,
        { type: "SHUTTER_PRESSED" },
      );
      expect(s).toBe(before);
    },
  );

  it("captures only with a current strict-ready attestation", () => {
    const s: CaptureMachineState = { phase: "aligning", goodSince: null, countdownEndsAt: null };
    expect(captureMachineReducer(s, { type: "SHUTTER_PRESSED", ready: true }).phase).toBe("capturing");
  });

  it("ignores repeat presses while capturing", () => {
    const s: CaptureMachineState = { phase: "capturing", goodSince: null, countdownEndsAt: null };
    expect(captureMachineReducer(s, { type: "SHUTTER_PRESSED" })).toBe(s);
  });

  it("RESET returns to searching", () => {
    const s: CaptureMachineState = { phase: "capturing", goodSince: null, countdownEndsAt: null };
    expect(captureMachineReducer(s, { type: "RESET" })).toEqual(initialCaptureState);
  });
});

describe("countdownRemaining", () => {
  const s: CaptureMachineState = { phase: "countdown", goodSince: 0, countdownEndsAt: 3000 };

  it("counts 3 → 2 → 1 and never shows 0", () => {
    expect(countdownRemaining(s, 0)).toBe(3);
    expect(countdownRemaining(s, 1000)).toBe(2);
    expect(countdownRemaining(s, 2000)).toBe(1);
    expect(countdownRemaining(s, 2999)).toBe(1);
  });

  it("is null outside countdown", () => {
    expect(countdownRemaining(initialCaptureState, 0)).toBeNull();
  });
});

describe("feedback damper", () => {
  it("holds the displayed message until the candidate persists", () => {
    let d = createDamper("no_face");
    d = dampFeedback(d, "too_dark", 0);
    expect(d.displayed).toBe("no_face"); // candidate registered, not promoted

    d = dampFeedback(d, "too_dark", FEEDBACK_HOLD_MS - 1);
    expect(d.displayed).toBe("no_face");

    d = dampFeedback(d, "too_dark", FEEDBACK_HOLD_MS);
    expect(d.displayed).toBe("too_dark");
  });

  it("restarts the hold when the candidate changes", () => {
    let d = createDamper("ok");
    d = dampFeedback(d, "too_dark", 0);
    d = dampFeedback(d, "blurry", 300); // new candidate, clock restarts
    d = dampFeedback(d, "blurry", 300 + FEEDBACK_HOLD_MS - 1);
    expect(d.displayed).toBe("ok");
    d = dampFeedback(d, "blurry", 300 + FEEDBACK_HOLD_MS);
    expect(d.displayed).toBe("blurry");
  });

  it("clears a pending candidate when the displayed code returns", () => {
    let d = createDamper("ok");
    d = dampFeedback(d, "too_dark", 0);
    d = dampFeedback(d, "ok", 100);
    expect(d.candidate).toBeNull();
    d = dampFeedback(d, "too_dark", 200);
    d = dampFeedback(d, "too_dark", 200 + FEEDBACK_HOLD_MS - 1);
    expect(d.displayed).toBe("ok"); // clock restarted at 200
  });
});

describe("stability tracker", () => {
  function samplesAt(positions: Array<[number, number, number]>): ReturnType<typeof pushStabilitySample> {
    let history: ReturnType<typeof pushStabilitySample> = [];
    for (const [at, x, y] of positions) {
      history = pushStabilitySample(history, { at, x, y, widthRatio: 0.4 });
    }
    return history;
  }

  it("reports stable for a still face across the window", () => {
    const history = samplesAt([
      [0, 0.5, 0.5],
      [250, 0.501, 0.5],
      [500, 0.5, 0.501],
      [700, 0.5, 0.5],
    ]);
    expect(isStable(history)).toBe(true);
  });

  it("reports unstable for a moving face", () => {
    const history = samplesAt([
      [0, 0.5, 0.5],
      [250, 0.53, 0.5],
      [500, 0.56, 0.5],
      [700, 0.6, 0.5],
    ]);
    expect(isStable(history)).toBe(false);
  });

  it("needs enough history to call it", () => {
    const history = samplesAt([[0, 0.5, 0.5]]);
    expect(isStable(history)).toBe(false);
  });

  it("drops samples older than the window", () => {
    const history = samplesAt([
      [0, 0.1, 0.1], // will fall out of the window
      [STABILITY_WINDOW_MS + 100, 0.5, 0.5],
      [STABILITY_WINDOW_MS + 400, 0.5, 0.5],
      [STABILITY_WINDOW_MS + 800, 0.5, 0.5],
    ]);
    expect(history[0]?.at).toBeGreaterThan(0);
    expect(isStable(history)).toBe(true);
  });
});
