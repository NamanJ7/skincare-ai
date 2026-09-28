/** Check-in step 3 of 3: routine adherence, optional note + progress photo. */
import { Redirect, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { checkInPhotoPrivacyLine } from "@/lib/analysis-status";
import { track } from "@/lib/analytics";
import { MAX_NOTE_LENGTH, type AdherenceFeel } from "@/lib/check-in";
import { clearDraft, getDraft, updateDraft } from "@/lib/check-in-session";
import { persistCheckInPhoto } from "@/lib/photos";
import { useCheckIns } from "@/state/check-ins";
import { FunnelScreen } from "@/components/FunnelScreen";
import {
  AppText,
  GhostButton,
  PhotoThumb,
  SectionHeader,
  Segmented,
  TextButton,
  TextField,
  spacing,
  useThemeColors,
} from "@/theme";

const ADHERENCE_OPTIONS: { value: AdherenceFeel; label: string }[] = [
  { value: "all", label: "All of it" },
  { value: "most", label: "Most" },
  { value: "some", label: "Some" },
  { value: "barely", label: "Barely" },
];

export default function CheckInWrapUp() {
  const colors = useThemeColors();
  const { add } = useCheckIns();
  const draft = getDraft();
  const [adherence, setAdherence] = useState<AdherenceFeel>(
    draft.followedRoutine ?? "most",
  );
  const [note, setNote] = useState(draft.note ?? "");
  const [photoUri, setPhotoUri] = useState(draft.photoUri);
  const [saving, setSaving] = useState(false);

  // Re-read after the photo screen pops back with a fresh capture.
  useFocusEffect(
    useCallback(() => {
      setPhotoUri(getDraft().photoUri);
    }, []),
  );

  if (!draft.skinFeel || !draft.breakouts) {
    return <Redirect href="/check-in" />;
  }
  const { skinFeel, breakouts } = draft;

  const finish = async () => {
    setSaving(true);
    const photoName = photoUri ? await persistCheckInPhoto(photoUri) : null;
    add({
      skinFeel,
      breakouts,
      irritationSigns: draft.irritationSigns ?? [],
      followedRoutine: adherence,
      photoName: photoName ?? undefined,
      note: note.trim() || undefined,
    });
    track("check_in_completed", {
      has_photo: !!photoName,
      has_note: !!note.trim(),
      irritation_count: (draft.irritationSigns ?? []).length,
    });
    clearDraft();
    router.replace("/check-in/summary");
  };

  return (
    <FunnelScreen
      dots={{ count: 3, index: 2 }}
      eyebrow="Weekly check-in"
      title="Almost done"
      titleVariant="titleSans"
      primaryLabel="Finish check-in"
      onPrimary={finish}
      primaryLoading={saving}
    >
      <AppText variant="headline">
        How much of your routine did you follow?
      </AppText>
      <Segmented
        options={ADHERENCE_OPTIONS}
        value={adherence}
        onChange={setAdherence}
      />

      <TextField
        label="Anything worth noting? (optional)"
        placeholder="New product, travel, stress, period…"
        value={note}
        onChangeText={setNote}
        multiline
        // Matches the bound addCheckIn() enforces, so a long note is trimmed
        // here rather than silently truncated after it is saved.
        maxLength={MAX_NOTE_LENGTH}
      />

      <View>
        <SectionHeader title="Progress photo" />
        {photoUri ? (
          <View style={{ gap: spacing.xs, alignItems: "flex-start" }}>
            <PhotoThumb uri={photoUri} width={120} />
            <TextButton
              label="Retake photo"
              onPress={() => router.push("/check-in/photo")}
            />
          </View>
        ) : (
          <GhostButton
            label="Add a progress photo"
            onPress={() => router.push("/check-in/photo")}
          />
        )}
        <AppText
          variant="caption"
          color={colors.textSecondary}
          style={{ marginTop: spacing.xs }}
        >
          This is optional and builds your before-and-after timeline.{" "}
          {checkInPhotoPrivacyLine()}
        </AppText>
      </View>
    </FunnelScreen>
  );
}
