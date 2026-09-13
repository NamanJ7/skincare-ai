import { Stack } from "expo-router";

/** Legal documents are read-only stack screens, reachable before sign-in. */
export default function LegalLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
