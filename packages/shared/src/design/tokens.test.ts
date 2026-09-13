import { describe, expect, it } from "vitest";

import {
  brandColors,
  colors,
  darkColors,
  lightColors,
  motion,
  type ThemeColors,
} from "./tokens";

type Rgb = readonly [number, number, number];

function hexToRgb(value: string): Rgb {
  const normalized = value.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function composite(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return [
    Math.round(foreground[0] * alpha + background[0] * (1 - alpha)),
    Math.round(foreground[1] * alpha + background[1] * (1 - alpha)),
    Math.round(foreground[2] * alpha + background[2] * (1 - alpha)),
  ];
}

function rgbaOn(value: string, background: string): Rgb {
  const channels = value.match(/[\d.]+/g)?.map(Number);
  if (!channels || channels.length !== 4) {
    throw new Error(`Expected rgba color, received ${value}`);
  }
  return composite(
    [channels[0]!, channels[1]!, channels[2]!],
    hexToRgb(background),
    channels[3]!,
  );
}

function colorOn(value: string, background: string): Rgb {
  return value.startsWith("rgba") ? rgbaOn(value, background) : hexToRgb(value);
}

function luminance(rgb: Rgb): number {
  const channelLuminance = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const red = channelLuminance(rgb[0]);
  const green = channelLuminance(rgb[1]);
  const blue = channelLuminance(rgb[2]);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(foreground: Rgb, background: Rgb): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("approved brand palette", () => {
  it("keeps the five approved swatches exact", () => {
    expect(brandColors).toEqual({
      warmIvory: "#F7F4EE",
      charcoal: "#1F1F1F",
      sage: "#A8B59A",
      softLavender: "#DCCFF0",
      mistGray: "#E6E7EB",
    });
  });

  it("uses contrast-safe charcoal content on Sage", () => {
    expect(
      contrast(
        hexToRgb(lightColors.onBrandAccent),
        hexToRgb(lightColors.brandAccent),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(lightColors.onBrandAccent).toBe(brandColors.charcoal);
  });
});

const themes = [
  ["light", lightColors],
  ["dark", darkColors],
] as const;

function expectTextContrast(
  foreground: string,
  background: string,
  minimum = 4.5,
) {
  expect(
    contrast(hexToRgb(foreground), colorOn(background, background)),
  ).toBeGreaterThanOrEqual(minimum);
}

describe("semantic light and dark colors", () => {
  it("keeps both themes structurally identical", () => {
    expect(Object.keys(darkColors).sort()).toEqual(
      Object.keys(lightColors).sort(),
    );
  });

  it.each(themes)("keeps %s theme core text at AA contrast", (_, theme) => {
    expectTextContrast(theme.textPrimary, theme.background);
    expectTextContrast(theme.textPrimary, theme.surface);
    expectTextContrast(theme.textPrimary, theme.surfaceElevated);
    expectTextContrast(theme.textSecondary, theme.background);
    expectTextContrast(theme.textSecondary, theme.surface);
    expectTextContrast(theme.onActionPrimary, theme.actionPrimary);
    expectTextContrast(theme.onBrandAccent, theme.brandAccent);
  });

  it.each(themes)("keeps %s semantic status copy readable", (_, theme) => {
    const background = theme.background;
    const pairs: Array<[string, keyof ThemeColors, keyof ThemeColors]> = [
      ["info", "onInfo", "infoSoft"],
      ["success", "onSuccess", "successSoft"],
      ["warning", "onWarning", "warningSoft"],
      ["error", "onError", "errorSoft"],
    ];
    for (const [, foregroundKey, tintKey] of pairs) {
      expect(
        contrast(
          hexToRgb(theme[foregroundKey]),
          colorOn(theme[tintKey], background),
        ),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("legacy semantic aliases", () => {
  it.each([
    ["gold", colors.gold],
    ["caution", colors.caution],
    ["escalate", colors.escalate],
  ] as const)("keeps %s at AA contrast on canvas and surface", (_, token) => {
    expect(
      contrast(hexToRgb(token), hexToRgb(colors.canvas)),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(hexToRgb(token), hexToRgb(colors.surface)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps warning text readable on its semantic tint", () => {
    expect(
      contrast(
        hexToRgb(colors.caution),
        rgbaOn(colors.cautionSoft, colors.canvas),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        hexToRgb(colors.escalate),
        rgbaOn(colors.escalateSoft, colors.canvas),
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe("camera guidance colors", () => {
  it("keeps the positive guide distinguishable on the camera surface", () => {
    expect(
      contrast(hexToRgb(colors.guidePositive), hexToRgb(colors.cameraSurface)),
    ).toBeGreaterThanOrEqual(3);
  });
});

describe("motion durations", () => {
  it("keeps durations positive and ordered from fast feedback to path drawing", () => {
    const durations = [
      motion.duration.fast,
      motion.duration.base,
      motion.duration.gentle,
      motion.duration.celebrate,
      motion.duration.draw,
    ];

    expect(durations.every((duration) => duration > 0)).toBe(true);
    expect(durations).toEqual([...durations].sort((a, b) => a - b));
    expect(new Set(durations).size).toBe(durations.length);
  });
});
