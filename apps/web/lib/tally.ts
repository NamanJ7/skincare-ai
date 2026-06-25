/**
 * Tally waitlist popup. The widget script is loaded once in app/layout.tsx;
 * here we expose a typed helper + the form id so every CTA stays consistent.
 *
 * To send users to the branded confirmation page after they submit, set the
 * Tally form's "Redirect on completion" to /waitlist/confirmed in the Tally
 * dashboard (no code change needed here).
 */

export const TALLY_FORM_ID = "LZVOM2";
export const TALLY_FORM_URL = `https://tally.so/r/${TALLY_FORM_ID}`;

type TallyPopupOptions = {
  layout?: "default" | "modal";
  width?: number;
  alignLeft?: boolean;
  hideTitle?: boolean;
  overlay?: boolean;
  emoji?: { text: string; animation?: string };
  autoClose?: number;
  onClose?: () => void;
  onSubmit?: () => void;
};

declare global {
  interface Window {
    Tally?: {
      openPopup: (formId: string, options?: TallyPopupOptions) => void;
      closePopup: (formId: string) => void;
      loadEmbeds: () => void;
    };
  }
}

/** Open the Pore waitlist as a centered modal. Falls back to the hosted form
 *  in a new tab if the widget script hasn't loaded yet. */
export function openWaitlist(): void {
  if (typeof window === "undefined") return;
  if (window.Tally?.openPopup) {
    window.Tally.openPopup(TALLY_FORM_ID, {
      layout: "modal",
      width: 540,
      overlay: true,
      emoji: { text: "🧴", animation: "wave" },
    });
  } else {
    window.open(TALLY_FORM_URL, "_blank", "noopener,noreferrer");
  }
}
