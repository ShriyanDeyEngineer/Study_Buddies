/**
 * Root layout — wraps every single page in the app (marketing, auth, and
 * the signed-in app alike).
 *
 * Responsibilities:
 *   1. Load our two fonts (Roboto for body/UI, DM Serif Display for
 *      headings) and expose them as CSS variables that globals.css maps
 *      into Tailwind's font-sans / font-display.
 *   2. Set the default <title> / description used for SEO on public pages.
 *   3. Mount the toast portal (sonner) once, so any page can fire a toast.
 *
 * Touch this file to change fonts, default metadata, or anything that must
 * exist on literally every page. Page chrome (headers, footers, nav) does
 * NOT belong here — that lives in the route-group layouts.
 */
import type { Metadata } from "next";
import { Roboto, DM_Serif_Display } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

/* Body/UI face. Two weights only (400/600) per the design spec — keeps
   page weight down. Roboto is a static font, so weights must be listed. */
const roboto = Roboto({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-roboto",
});

/* Display face ships in a single 400 weight; that is all headings use. */
const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--times-new-roman",
});

export const metadata: Metadata = {
  title: {
    default: "Study Buddies — Find study partners at the U",
    template: "%s · Study Buddies",
  },
  description:
    "Never study alone at the U again. Find study partners and join study groups for your University of Minnesota courses.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${roboto.variable} ${dmSerif.variable}`}>
      <body>
        {children}
        {/* One global toast portal. richColors keeps success green /
            error red consistent with our semantic tokens. */}
        <Toaster richColors position="top-center" />
        <Analytics />
      </body>
    </html>
  );
}
