import Constants from "expo-constants";
import * as Device from "expo-device";
import { Share } from "react-native";

import { notify } from "../dialogs";
import { calibrationLogSize, dumpCalibrationLog } from "./calibration-log";

/** Opens the native share sheet with a self-describing JSONL calibration log. */
export async function shareCalibrationLog(): Promise<boolean> {
  if (calibrationLogSize() === 0) {
    notify(
      "No calibration samples yet",
      "Open the scan camera and collect a few frames first.",
    );
    return false;
  }

  const message = dumpCalibrationLog({
    appVersion:
      Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? null,
    buildVersion: Constants.nativeBuildVersion ?? null,
    deviceModel: Device.modelName ?? null,
    osName: Device.osName ?? null,
    osVersion: Device.osVersion ?? null,
  });
  await Share.share({ title: "Pore scan calibration JSONL", message });
  return true;
}
