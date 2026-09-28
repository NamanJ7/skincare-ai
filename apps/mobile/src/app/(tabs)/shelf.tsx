import { Redirect } from "expo-router";

/** Compatibility route for existing reminders, bookmarks, and deep links. */
export default function ShelfRedirect() {
  return <Redirect href="/(tabs)/routine?section=products" />;
}
