/**
 * Where the legal documents live, and how to reach them.
 *
 * These used to be `https://pore.skin/{privacy,terms}` opened with
 * `Linking.openURL`. That domain was never registered, so every legal link in
 * the app — including the two in the youth-consent flow — landed the reader on
 * a browser error page. The documents now ship in the bundle and are reached
 * with in-app routes, which also means they work offline and before sign-in.
 *
 * `WEBSITE_*_URL` are the public mirrors of the same `@pore/shared/legal`
 * documents. They are prose references only: nothing in the app navigates to
 * them, so an unreachable marketing site can never break an in-app link again.
 */
import { LEGAL_CONFIG } from "@pore/shared/legal";

export const TERMS_ROUTE = "/legal/terms" as const;
export const PRIVACY_ROUTE = "/legal/privacy" as const;

/** Every in-app legal destination, for route-integrity checks. */
export const LEGAL_ROUTES = [TERMS_ROUTE, PRIVACY_ROUTE] as const;

export const SUPPORT_EMAIL = LEGAL_CONFIG.supportEmail;

export const WEBSITE_TERMS_URL = `${LEGAL_CONFIG.websiteUrl}/terms`;
export const WEBSITE_PRIVACY_URL = `${LEGAL_CONFIG.websiteUrl}/privacy`;
