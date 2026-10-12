import type { Metadata, Viewport } from "next";
import { Baloo_2, Geist } from "next/font/google";
import "./globals.css";
import { SwRegister } from "@/lib/sw-register";

const display = Baloo_2({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kids English — Tap, Hear, Learn!",
  description:
    "A cute tap-first English learning game for toddlers and preschoolers.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Kids English" },
};

/** Mobile-first viewport: no pinch zoom (toddler taps), edge-to-edge. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#8ED8F8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#8ED8F8] font-sans">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
