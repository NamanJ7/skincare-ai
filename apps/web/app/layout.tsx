import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pore.skin"),
  title: {
    default: "Pore - Skincare that understands your skin",
    template: "%s - Pore",
  },
  description:
    "Pore helps you build, track, and improve your skincare routine with personalized guidance that starts from a guided photo of your face.",
  openGraph: {
    title: "Pore - Skincare that understands your skin",
    description:
      "Start with a face photo. Get smarter routines, product choices, and progress tracking.",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/logo-mark-192.png", sizes: "192x192", type: "image/png" },
      { url: "/logo-mark-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/logo-mark-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

/**
 * Every route renders per request so the CSP nonce can be applied.
 *
 * This is load-bearing, not incidental. proxy.ts mints a nonce per request and
 * the policy has no 'unsafe-inline', so Next's ~40 inline bootstrap and
 * flight-data scripts must carry that nonce. A statically prerendered page is
 * generated at build time, when the proxy has never run — its inline scripts
 * carry no nonce, and the browser blocks every one of them, so the page ships
 * as unhydrated HTML. Reading headers() is what opts the tree out of static
 * generation and lets Next stamp the nonce during the request-time render.
 *
 * The cost is a prerender, not a model call: these are marketing pages backed
 * by in-repo data. Verified by curling the built app for `nonce=` attributes —
 * see docs/security-audit-2026-08-24.md.
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Establishes the request-time dependency that carries the nonce.
  await headers();
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        {children}
      </body>
    </html>
  );
}
