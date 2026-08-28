/** Primary site navigation. Add entries here to extend the nav later. */
export type NavLink = { label: string; href: string };

export const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Why Pore", href: "/#why-pore" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
];

export const FOOTER_NAV: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
  { label: "Login", href: "/login" },
];

export const LEGAL_LINKS: NavLink[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Use", href: "/terms" },
  { label: "Contact", href: "/contact" },
];

export const SOCIAL_LINKS: NavLink[] = [
  { label: "Instagram", href: "https://www.instagram.com/getpore.ai/" },
  { label: "TikTok", href: "https://www.tiktok.com/@pore.ai" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/poreai/" },
];

/**
 * The disclaimer now lives in @pore/shared so the mobile app can use the exact
 * same string. Re-exported here so existing import sites keep working.
 */
export { MEDICAL_DISCLAIMER } from "@pore/shared";
