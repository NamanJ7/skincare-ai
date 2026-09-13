/** The visible post-onboarding destinations, in their product-approved order. */
export const APP_TABS = [
  {
    name: "index",
    title: "Home",
    icon: "home-outline",
    focusedIcon: "home",
  },
  {
    name: "progress",
    title: "Progress",
    icon: "map-outline",
    focusedIcon: "map",
  },
  {
    name: "scan",
    title: "Scan",
    icon: "scan-outline",
    focusedIcon: "scan",
  },
  {
    name: "routine",
    title: "Routine",
    icon: "list-outline",
    focusedIcon: "list",
  },
  {
    name: "profile",
    title: "Profile",
    icon: "person-outline",
    focusedIcon: "person",
  },
] as const;

export type AppTabName = (typeof APP_TABS)[number]["name"];

export const APP_TAB_ORDER: readonly AppTabName[] = APP_TABS.map(
  (tab) => tab.name,
);

