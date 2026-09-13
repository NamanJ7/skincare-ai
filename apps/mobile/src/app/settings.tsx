import { Redirect } from "expo-router";

/** Compatibility route for old bookmarks and notification links. */
export default function SettingsRedirect() {
  return <Redirect href="/(tabs)/profile" />;
}
