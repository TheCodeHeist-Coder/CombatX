import "./globals.css";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={GeistSans.className}>{children}</body>
    </html>
  );
}
