import { Image } from "expo-image";
import { View } from "react-native";

import type { MascotState } from "./mascot-states";

const PORE_LOGO = require("../../../assets/images/pore-logo.png");

/**
 * The companion uses the approved Pore mark. State remains available to the
 * parent for motion and accessible copy; the logo itself is never redrawn,
 * recoloured, or used as the sole carrier of meaning.
 */
export function DropletBuddyArt({
  size,
}: {
  state: MascotState;
  size: number;
}) {
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Image
        source={PORE_LOGO}
        contentFit="contain"
        accessible={false}
        style={{ width: size, height: size }}
      />
    </View>
  );
}
