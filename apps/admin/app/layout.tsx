import "./globals.css";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

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
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className={GeistSans.className}>{children}</body>
    </html>
  );
}
