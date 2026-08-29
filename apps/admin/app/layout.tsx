import "./globals.css";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";

/**
 * The same two display faces the player app uses, so the console's sign-in
 * screen reads as the same product rather than as a separate tool.
 *
 * Both are committed to the repo and loaded with next/font/local rather than
 * fetched from Google Fonts at build time — a production build must not depend
 * on reaching a third party.
 */
const lacquer = localFont({
  src: "./fonts/Lacquer-Regular.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-display",
  fallback: ["Arial", "sans-serif"],
  adjustFontFallback: false,
});

const fingerPaint = localFont({
  src: "./fonts/FingerPaint-Regular.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-button",
  fallback: ["Arial", "sans-serif"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "CombatX Admin",
  description: "Operations console for CombatX.",
  // The console must never be indexed, even if it is ever exposed publicly.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0b0d11",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${lacquer.variable} ${fingerPaint.variable}`}
    >
      <body className={GeistSans.className}>{children}</body>
    </html>
  );
}
