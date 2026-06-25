import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Script from "next/script";
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
    default: "Pore — Skincare that understands your skin",
    template: "%s — Pore",
  },
  description:
    "Pore helps you build, track, and improve your skincare routine with personalized guidance based on your skin, products, goals, and progress.",
  openGraph: {
    title: "Pore — Skincare that understands your skin",
    description:
      "Personalized routines. Smarter product choices. Clearer progress.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        {children}
        {/* Tally popup widget — drives every "Join the Waitlist" CTA (form LZVOM2). */}
        <Script
          src="https://tally.so/widgets/embed.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
