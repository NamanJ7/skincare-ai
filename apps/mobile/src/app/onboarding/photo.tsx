/**
 * Guided capture — the part of Pore that decides whether the assessment is
 * worth anything.
 *
 * One screen rather than four routes: every state shares the camera mount, and
 * back-navigating mid-capture must not resurrect a stale frame.
 *
 * Two ideas do the work here. The screen flash gives every photo the same
 * known illuminant, so three shots taken in three different rooms are still
 * comparable. The quality gate measures each frame before it is allowed to
 * count, and rejects it inline with one fixable instruction rather than letting
 * a blurry backlit photo become a confident wrong answer.
 */
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from "expo-camera";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";

import type { SkinTone } from "@pore/shared";
import { CaptureFrame } from "@/components/CaptureFrame";
import {
  CAPTURE_STEPS,
  isRejected,
  newSessionId,
  processCapture,
  writeManifest,
  type CapturedPhoto,
} from "@/lib/photos";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  Card,
  Chip,
  GhostButton,
  PrimaryButton,
  Screen,
  colors,
  radius,
  spacing,
} from "@/theme";

/**
 * Whether to use the camera's native `flash="screen"` mode.
 *
 * `'screen'` is a documented SDK 56 FlashMode, but the docs do not describe its
 * front-camera behaviour, so this must be confirmed on a real device. If it
 * turns out to be a no-op, flip this to false: the app then paints its own
 * white overlay for FLASH_MS around the shot and records the photo as
 * ambient-lit, which is honest rather than a silently broken claim.
 */
const USE_NATIVE_SCREEN_FLASH = true;
/** How long the fallback white overlay stays up before the shutter fires. */
const FLASH_MS = 260;

/**
 * Tone bands, asked here rather than in the questionnaire.
 *
 * Capture comes before intake now, and the exposure floor has to move with skin
 * tone — a single fixed floor tells darker-skinned users their perfectly good
 * photo is "too dark", over and over. Asking at the moment it calibrates the
 * camera also gives the question a visible reason, instead of being one more
 * anonymous questionnaire step.
 */
const TONES: { key: SkinTone; label: string }[] = [
  { key: "very_fair", label: "Very fair" },
  { key: "fair", label: "Fair" },
  { key: "medium", label: "Medium" },
  { key: "olive", label: "Olive" },
  { key: "brown", label: "Brown" },
  { key: "deep", label: "Deep" },
];

type Stage = "intro" | "capturing" | "reviewing";

export default function PhotoCapture() {
  const { data, update } = useOnboarding();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);

  const [stage, setStage] = useState<Stage>("intro");
  const [tone, setTone] = useState<SkinTone | null>(data.skinTone ?? null);
  /** One id for this whole visit, so retakes land in the same session folder. */
  const [sessionId] = useState(() => newSessionId());
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mountError, setMountError] = useState<string | null>(null);
  /** Consecutive rejections on the current angle — two, and we offer a way past. */
  const [strikes, setStrikes] = useState(0);

  const step = CAPTURE_STEPS[stepIndex]!;

  async function begin() {
    if (!tone) return;
    update({ skinTone: tone });
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setStage("capturing");
  }

  const finishStep = useCallback(
    (photo: CapturedPhoto) => {
      setPhotos((prev) => [...prev.filter((p) => p.angle !== photo.angle), photo]);
      setStrikes(0);
      setError(null);
      // Retakes come back with every angle already captured; go straight to review.
      const next = CAPTURE_STEPS.findIndex(
        (s, i) => i > stepIndex && !photos.some((p) => p.angle === s.angle),
      );
      if (next === -1) setStage("reviewing");
      else setStepIndex(next);
    },
    [photos, stepIndex],
  );

  async function shoot(force = false) {
    if (!camera.current || !ready || busy || !tone) return;
    setBusy(true);
    setError(null);

    let picture: CameraCapturedPicture | undefined;
    try {
      if (!USE_NATIVE_SCREEN_FLASH) {
        setFlashing(true);
        await new Promise((r) => setTimeout(r, FLASH_MS));
      }
      picture = await camera.current.takePictureAsync({ quality: 0.9, exif: true });
    } catch {
      setError("Couldn't take that photo — try again");
      setBusy(false);
      setFlashing(false);
      return;
    } finally {
      setFlashing(false);
    }

    if (!picture) {
      setError("Couldn't take that photo — try again");
      setBusy(false);
      return;
    }

    try {
      const outcome = await processCapture(
        picture,
        step.angle,
        tone,
        USE_NATIVE_SCREEN_FLASH ? "screen_flash" : "ambient",
        sessionId,
        force,
      );

      if (isRejected(outcome)) {
        setStrikes((s) => s + 1);
        setError(outcome.hint);
      } else {
        finishStep(outcome);
      }
    } catch {
      // A frame we cannot decode is, from the user's side, the same as a frame
      // that came out badly: take another one.
      setStrikes((s) => s + 1);
      setError("That one didn't come through — try again");
    } finally {
      setBusy(false);
    }
  }

  /** Keep the already-good photos; re-shoot just the angle the user tapped. */
  function retake(index: number) {
    setStepIndex(index);
    setStrikes(0);
    setError(null);
    setStage("capturing");
  }

  /**
   * Capture ends here; the plan is generated at the end of intake.
   *
   * The photos come first because that is the moment someone decides this
   * product is real, but the assessment still needs the questionnaire answers,
   * so generation waits for them rather than running on defaults.
   */
  function done() {
    writeManifest(photos, sessionId);
    update({ photos });
    router.push("/onboarding/intake");
  }

  // ---------------------------------------------------------------- intro --
  if (stage === "intro") {
    const denied = permission !== null && !permission.granted && !permission.canAskAgain;
    return (
      <Screen contentStyle={{ paddingTop: spacing.lg }}>
        <AppText variant="title">Let&apos;s look at your skin</AppText>
        <AppText variant="body" color={colors.inkMuted}>
          Three quick photos — straight on, then each side. Your screen lights your face so all three
          are taken under the same light. This is a cosmetic look at what&apos;s visible, never a
          diagnosis.
        </AppText>

        <Card>
          <AppText variant="bodyStrong">Which is closest to your skin?</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            This sets the exposure. Skin tones reflect light differently, and a camera calibrated for
            one tone misreads the others.
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs }}>
            {TONES.map((t) => (
              <Chip
                key={t.key}
                label={t.label}
                tone="lavender"
                selected={tone === t.key}
                onPress={() => setTone(t.key)}
              />
            ))}
          </View>
        </Card>

        <Card>
          <AppText variant="caption" color={colors.ink}>• Take off makeup and glasses</AppText>
          <AppText variant="caption" color={colors.ink}>• Tie hair back off your forehead</AppText>
          <AppText variant="caption" color={colors.ink}>• Hold the phone at eye level, arm&apos;s length</AppText>
        </Card>

        {denied ? (
          <Card>
            <AppText variant="bodyStrong" color={colors.escalate}>Camera access is off</AppText>
            <AppText variant="caption" color={colors.inkMuted}>
              Pore needs the camera to take your photos. Nothing is recorded until you press the
              shutter.
            </AppText>
            <GhostButton label="Open Settings" onPress={() => Linking.openSettings()} />
          </Card>
        ) : (
          <PrimaryButton label="Start" onPress={begin} disabled={!tone} />
        )}

        <Pressable
          onPress={() => router.push("/legal/privacy")}
          accessibilityRole="link"
          accessibilityLabel="Your photos stay on your phone. Read the Privacy Policy."
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <AppText variant="caption" color={colors.inkMuted} style={{ textAlign: "center" }}>
            Your photos stay on your phone. They&apos;re sent for this analysis, never saved on our
            servers, and you can delete them any time.
          </AppText>
          <AppText variant="caption" color={colors.primary} style={{ textAlign: "center" }}>
            Read the Privacy Policy
          </AppText>
        </Pressable>
      </Screen>
    );
  }

  // ------------------------------------------------------------ capturing --
  if (stage === "capturing") {
    if (mountError) {
      return (
        <Screen contentStyle={{ paddingTop: spacing.lg }}>
          <AppText variant="title">Camera unavailable</AppText>
          <AppText variant="body" color={colors.inkMuted}>{mountError}</AppText>
          <PrimaryButton label="Try again" onPress={() => { setMountError(null); setReady(false); }} />
          <GhostButton label="Back" onPress={() => setStage("intro")} />
        </Screen>
      );
    }

    return (
      <View style={styles.cameraRoot}>
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="front"
          mirror
          animateShutter={false}
          autofocus="on"
          flash={USE_NATIVE_SCREEN_FLASH ? "screen" : "off"}
          onCameraReady={() => setReady(true)}
          onMountError={(e) => setMountError(e.message)}
        />

        {/* Fallback illuminant: paint the display white around the shutter. */}
        {flashing ? <View style={styles.flash} /> : null}

        <CaptureFrame
          title={step.title}
          hint={step.hint}
          error={error}
          stepIndex={stepIndex}
          stepCount={CAPTURE_STEPS.length}
        />

        <View style={styles.controls}>
          {strikes >= 2 ? (
            <Pressable onPress={() => shoot(true)} style={({ pressed }) => [styles.useAnyway, pressed && styles.pressed]}>
              <AppText variant="caption" color={colors.onPrimary}>Use it anyway</AppText>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => shoot()}
            disabled={!ready || busy}
            accessibilityRole="button"
            accessibilityLabel={`Take the ${step.angle} photo`}
            style={({ pressed }) => [
              styles.shutter,
              (!ready || busy) && styles.shutterDisabled,
              pressed && styles.pressed,
            ]}
          >
            {busy ? <ActivityIndicator color={colors.primary} /> : <View style={styles.shutterInner} />}
          </Pressable>
        </View>
      </View>
    );
  }

  // ------------------------------------------------------------ reviewing --
  if (stage === "reviewing") {
    return (
      <Screen contentStyle={{ paddingTop: spacing.lg }}>
        <AppText variant="title">All three, checked</AppText>
        <AppText variant="body" color={colors.inkMuted}>
          Each one passed the sharpness and lighting check. Tap any photo to take it again.
        </AppText>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {CAPTURE_STEPS.map((s, i) => {
            const photo = photos.find((p) => p.angle === s.angle);
            return (
              <Pressable key={s.angle} onPress={() => retake(i)} style={{ flex: 1, gap: spacing.xxs }}>
                <Image
                  source={{ uri: photo?.uri }}
                  style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.surface }}
                  contentFit="cover"
                />
                <AppText variant="caption" color={colors.inkMuted} style={{ textAlign: "center" }}>
                  {s.angle}
                  {photo?.quality.flags.length ? " · flagged" : ""}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <PrimaryButton label="Next — a few quick questions" onPress={done} />
      </Screen>
    );
  }

  // `stage` is exhausted above; this satisfies the compiler.
  return null;
}

const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: "center" },
  pressed: { opacity: 0.6 },
  cameraRoot: { flex: 1, backgroundColor: colors.ink },
  flash: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#FFFFFF" },
  controls: {
    position: "absolute",
    bottom: spacing.xl,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: spacing.sm,
  },
  useAnyway: {
    backgroundColor: "rgba(28,28,26,0.7)",
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterDisabled: { opacity: 0.45 },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.onPrimary,
  },
});
