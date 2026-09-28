import { ScanFlow } from "@/components/scan/ScanFlow";

/**
 * Server shell only — everything camera/MediaPipe-related lives behind the
 * ScanFlow client boundary so nothing browser-only is evaluated during SSR.
 */
export default function ScanPage() {
  return <ScanFlow />;
}
