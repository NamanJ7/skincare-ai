export * from "./types";
export * from "./config";
export { TERMS_OF_USE } from "./terms";
export { PRIVACY_NOTICE } from "./privacy";

import { PRIVACY_NOTICE } from "./privacy";
import { TERMS_OF_USE } from "./terms";
import type { LegalDocument, LegalDocumentId } from "./types";

/** Every legal document, keyed by id. The single source both apps render. */
export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  terms: TERMS_OF_USE,
  privacy: PRIVACY_NOTICE,
};
