import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";

import { SWRegister } from "@/components/SWRegister";
import { Providers } from "@/components/ui/Providers";

import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TravelTrack Beta · Plaksha",
  description: "Share a ride from anywhere to anywhere with people from Plaksha.",
  manifest: "/manifest.webmanifest",
  applicationName: "TravelTrack Beta",
  appleWebApp: { capable: true, title: "TravelTrack Beta", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E7E9E4" },
    { media: "(prefers-color-scheme: dark)", color: "#090C0A" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="min-h-dvh bg-canvas font-sans text-ink">
        <Providers>{children}</Providers>
        <SWRegister />
      </body>
    </html>
  );
}
