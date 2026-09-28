import { describe, expect, it } from "vitest";

import {
  mirrorPerceptualHash,
  orientPreviewPerceptualHash,
  perceptualHashSimilarity,
  regionalOcclusion,
  sampleFacialSkinFromLumaPlane,
  sampleFacialSkinFromRgba,
  scaleFacialSamplingGeometry,
  type FacialSamplingGeometry,
} from "./pixel-evidence";

const FACE = { x: 20, y: 10, width: 60, height: 80 };

function rgba(
  width: number,
  height: number,
  at: (x: number, y: number) => number,
): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = at(x, y);
      const offset = (y * width + x) * 4;
      out[offset] = value;
      out[offset + 1] = value;
      out[offset + 2] = value;
      out[offset + 3] = 255;
    }
  }
  return out;
}

describe("facial skin pixel evidence", () => {
  it("does not let a sharp background hide a blurry face", () => {
    const sample = sampleFacialSkinFromRgba(
      rgba(100, 100, (x, y) => {
        const inFace = x >= 20 && x < 80 && y >= 10 && y < 90;
        return inFace ? 130 : (x + y) % 2 === 0 ? 20 : 235;
      }),
      100,
      100,
      FACE,
    );
    expect(sample).not.toBeNull();
    expect(sample!.sharpness).toBeLessThan(0.001);
    expect(sample!.nearlyUniform).toBe(true);
  });

  it("separates sharp from blurred skin on a large, near-native face", () => {
    // The regression this guards: sharpness used to be measured on a 384px
    // render of the whole photo, leaving the face around 150px wide. That
    // downscale is itself a low-pass filter, so real focus blur in the image
    // the model receives was already gone by the time the gate looked — sharp
    // and blurred captures scored the same and both passed.
    const scale = 8;
    const size = 100 * scale;
    const face = {
      x: FACE.x * scale,
      y: FACE.y * scale,
      width: FACE.width * scale,
      height: FACE.height * scale,
    };
    // Deterministic fine texture at a fixed physical scale, standing in for
    // pores and micro-relief.
    const texture = (x: number, y: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return 110 + Math.floor((n - Math.floor(n)) * 60);
    };
    const blurRadius = 3;
    const blurred = (x: number, y: number) => {
      let sum = 0;
      let count = 0;
      for (let dy = -blurRadius; dy <= blurRadius; dy++) {
        for (let dx = -blurRadius; dx <= blurRadius; dx++) {
          sum += texture(x + dx, y + dy);
          count += 1;
        }
      }
      return sum / count;
    };

    const sharp = sampleFacialSkinFromRgba(rgba(size, size, texture), size, size, face);
    const soft = sampleFacialSkinFromRgba(rgba(size, size, blurred), size, size, face);

    expect(sharp).not.toBeNull();
    expect(soft).not.toBeNull();
    expect(sharp!.gradientEnergy).toBeGreaterThan(soft!.gradientEnergy * 3);
    expect(sharp!.laplacianVariance).toBeGreaterThan(soft!.laplacianVariance * 3);
  });

  it("measures clipping inside the face rather than the whole frame", () => {
    const sample = sampleFacialSkinFromRgba(
      rgba(100, 100, (x) => (x >= 20 && x < 80 ? 250 : 110)),
      100,
      100,
      FACE,
    );
    expect(sample!.highlightClipping).toBeGreaterThan(0.95);
  });

  it("detects meaningfully uneven cheek lighting", () => {
    const sample = sampleFacialSkinFromRgba(
      rgba(100, 100, (x, y) => {
        if (x < 50 && y >= 40 && y < 70) return 45;
        if (x >= 50 && y >= 40 && y < 70) return 205;
        return 125 + ((x + y) % 3) * 3;
      }),
      100,
      100,
      FACE,
    );
    expect(sample!.cheekLumaDifference).toBeGreaterThan(0.4);
    expect(sample!.lightingUniformity).toBeLessThan(0.6);
  });

  it("honors plane row padding", () => {
    const width = 100;
    const height = 100;
    const row = 112;
    const bytes = new Uint8Array(row * height).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++)
        bytes[y * row + x] = 120 + ((x + y) % 2) * 20;
    }
    const sample = sampleFacialSkinFromLumaPlane(
      bytes,
      width,
      height,
      row,
      FACE,
    );
    expect(sample?.meanLuma).toBeGreaterThan(0.45);
    expect(sample?.sampleCount).toBeGreaterThan(100);
  });

  it("rejects invalid pixel buffers instead of manufacturing evidence", () => {
    expect(
      sampleFacialSkinFromLumaPlane(new Uint8Array(10), 100, 100, 100, FACE),
    ).toBeNull();
    expect(
      sampleFacialSkinFromRgba(new Uint8Array(10), 100, 100, FACE),
    ).toBeNull();
  });

  it("uses detector-derived skin regions and excludes facial features", () => {
    const geometry: FacialSamplingGeometry = {
      skinRegions: [
        {
          center: { x: 50, y: 26 },
          radiusX: 18,
          radiusY: 8,
          role: "center",
        },
        {
          center: { x: 36, y: 55 },
          radiusX: 12,
          radiusY: 11,
          role: "left",
        },
        {
          center: { x: 64, y: 55 },
          radiusX: 12,
          radiusY: 11,
          role: "right",
        },
        {
          center: { x: 50, y: 77 },
          radiusX: 11,
          radiusY: 6,
          role: "center",
        },
      ],
      excludedRegions: [
        {
          center: { x: 50, y: 55 },
          radiusX: 10,
          radiusY: 9,
          role: "exclude",
        },
      ],
    };
    const sample = sampleFacialSkinFromRgba(
      rgba(100, 100, (x, y) =>
        Math.hypot(x - 50, y - 55) <= 9 ? 255 : 110 + ((x + y) % 5),
      ),
      100,
      100,
      FACE,
      geometry,
    );
    expect(sample).not.toBeNull();
    expect(sample!.highlightClipping).toBeLessThan(0.01);
    expect(sample!.leftFaceLuma).toBeGreaterThan(100);
    expect(sample!.rightFaceLuma).toBeGreaterThan(100);
  });

  it("scales detector geometry with the decoded image", () => {
    const geometry: FacialSamplingGeometry = {
      skinRegions: [
        {
          center: { x: 10, y: 20 },
          radiusX: 4,
          radiusY: 5,
          role: "left",
        },
        {
          center: { x: 20, y: 20 },
          radiusX: 4,
          radiusY: 5,
          role: "right",
        },
        {
          center: { x: 15, y: 10 },
          radiusX: 5,
          radiusY: 3,
          role: "center",
        },
      ],
      excludedRegions: [],
      faceContour: [
        { x: 1, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 2 },
      ],
    };
    const scaled = scaleFacialSamplingGeometry(geometry, 2, 3);
    expect(scaled?.skinRegions[0]).toMatchObject({
      center: { x: 20, y: 60 },
      radiusX: 8,
      radiusY: 15,
    });
    expect(scaled?.faceContour?.[1]).toEqual({ x: 4, y: 9 });
  });
});

describe("perceptual hash similarity", () => {
  it("returns one only for identical valid hashes", () => {
    expect(
      perceptualHashSimilarity("0123456789abcdef", "0123456789abcdef"),
    ).toBe(1);
    expect(
      perceptualHashSimilarity("0000000000000000", "ffffffffffffffff"),
    ).toBe(0);
  });

  it("fails closed for malformed hashes", () => {
    expect(perceptualHashSimilarity("same", "same")).toBe(0);
  });

  it("mirrors each 8-bit hash row without moving rows", () => {
    expect(mirrorPerceptualHash("0123456789abcdef")).toBe("80c4a2e691d5b3f7");
    expect(mirrorPerceptualHash("not-a-hash")).toBe("not-a-hash");
  });

  it("normalizes live hashes from per-frame camera mirror metadata", () => {
    const hash = "0123456789abcdef";
    expect(orientPreviewPerceptualHash(hash, false)).toBe(hash);
    expect(orientPreviewPerceptualHash(hash, true)).toBe("80c4a2e691d5b3f7");
  });
});

describe("regional occlusion", () => {
  // Region order matches REGION_ROLES: forehead, left cheek, right cheek, chin.
  const EVEN_LUMA = [130, 130, 130, 130];
  const EVEN_COUNT = [400, 400, 400, 400];
  const EVEN_TEXTURE = [8000, 8000, 8000, 8000];
  const EVEN_TEXTURE_COUNT = [400, 400, 400, 400];

  it("reports nothing when every region reads like skin", () => {
    expect(
      regionalOcclusion(
        EVEN_LUMA.map((v, i) => v * EVEN_COUNT[i]!),
        EVEN_COUNT,
        EVEN_TEXTURE.map((v, i) => v * EVEN_TEXTURE_COUNT[i]!),
        EVEN_TEXTURE_COUNT,
      ),
    ).toBe(0);
  });

  it("flags a region that is both far darker and far flatter than the rest", () => {
    // A hand or mask over the left cheek: brightness collapses AND the pore
    // texture disappears.
    const luma = [130, 30, 130, 130];
    const texture = [8000, 500, 8000, 8000];
    expect(
      regionalOcclusion(
        luma.map((v, i) => v * EVEN_COUNT[i]!),
        EVEN_COUNT,
        texture.map((v, i) => v * EVEN_TEXTURE_COUNT[i]!),
        EVEN_TEXTURE_COUNT,
      ),
    ).toBeCloseTo(0.25);
  });

  it("flags hair as a busy-texture outlier, not just a dark one", () => {
    const luma = [30, 130, 130, 130];
    const texture = [40_000, 8000, 8000, 8000];
    expect(
      regionalOcclusion(
        luma.map((v, i) => v * EVEN_COUNT[i]!),
        EVEN_COUNT,
        texture.map((v, i) => v * EVEN_TEXTURE_COUNT[i]!),
        EVEN_TEXTURE_COUNT,
      ),
    ).toBeCloseTo(0.25);
  });

  it("does NOT flag hard side lighting, which shifts brightness but keeps texture", () => {
    // A 75-luma swing is more than the gates allow between cheeks, yet the
    // skin texture is intact — this is light, not a covering. Requiring both
    // signals is the whole reason this is usable as a gate.
    const luma = [130, 55, 130, 130];
    expect(
      regionalOcclusion(
        luma.map((v, i) => v * EVEN_COUNT[i]!),
        EVEN_COUNT,
        EVEN_TEXTURE.map((v, i) => v * EVEN_TEXTURE_COUNT[i]!),
        EVEN_TEXTURE_COUNT,
      ),
    ).toBe(0);
  });

  it("does NOT flag a merely smooth region that is still normally lit", () => {
    const texture = [8000, 500, 8000, 8000];
    expect(
      regionalOcclusion(
        EVEN_LUMA.map((v, i) => v * EVEN_COUNT[i]!),
        EVEN_COUNT,
        texture.map((v, i) => v * EVEN_TEXTURE_COUNT[i]!),
        EVEN_TEXTURE_COUNT,
      ),
    ).toBe(0);
  });

  it("stays silent rather than guessing when fewer than three regions were sampled", () => {
    // A strong profile can lose the far cheek entirely. The framing and pose
    // gates already cover that; occlusion must not block on it as well.
    const counts = [400, 400, 0, 0];
    const luma = [130, 30, 0, 0];
    const texture = [8000, 500, 0, 0];
    expect(
      regionalOcclusion(
        luma.map((v, i) => v * counts[i]!),
        counts,
        texture.map((v, i) => v * counts[i]!),
        counts,
      ),
    ).toBe(0);
  });

  it("measures occlusion end to end from real pixels", () => {
    // Textured skin everywhere except the left-cheek band, which is covered by
    // something flat and dark.
    const face = { x: 20, y: 10, width: 160, height: 170 };
    const skin = (x: number, y: number) => ((x + y) % 2 === 0 ? 65 : 175);
    const inLeftCheek = (x: number, y: number) => {
      const nx = (x - face.x) / face.width;
      const ny = (y - face.y) / face.height;
      return nx >= 0.12 && nx <= 0.43 && ny >= 0.4 && ny <= 0.72;
    };

    const clean = sampleFacialSkinFromRgba(
      rgba(200, 200, skin),
      200,
      200,
      face,
    );
    expect(clean).not.toBeNull();
    expect(clean!.occlusionRatio).toBe(0);

    const covered = sampleFacialSkinFromRgba(
      rgba(200, 200, (x, y) => (inLeftCheek(x, y) ? 25 : skin(x, y))),
      200,
      200,
      face,
    );
    expect(covered).not.toBeNull();
    expect(covered!.occlusionRatio).toBeGreaterThan(0);
  });
});
