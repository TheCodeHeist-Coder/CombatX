import "./globals.css";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";

/**
 * The display face for the CODE BATTLE wordmark.
 *
 * The woff2 is committed to the repo and loaded with next/font/local rather
 * than fetched from Google Fonts at build time. `next/font/google` downloads
 * the file during every production build, which fails outright on a slow or
 * offline network — the build must not depend on reaching a third party.
 *
 * The metric overrides come from Google's own Lacquer stylesheet; they size
 * the Arial fallback to match so there is no layout shift as the face swaps in.
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

/**
 * The interface face for buttons and navigation. Finger Paint is a
 * hand-painted script that matches the Lacquer wordmark, so the chrome reads
 * as part of the same poster rather than as system UI.
 *
 * Self-hosted for the same reason as Lacquer: a production build must not
 * depend on reaching Google Fonts.
 */
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
  title: "CombatX — real-time coding battles",
  description:
    "Race an opponent to solve the same problem. First to pass every test wins.",
};

/**
 * Tells the browser to render form controls and scrollbars dark before any CSS
 * loads, so a reload never flashes a white page.
 */
export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0d0e12",
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
