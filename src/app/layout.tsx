import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERANGEL OPS: Battlegrounds 3D Multiplayer Shooter",
  description:
    "3D Tactical Multiplayer & Offline Battlegrounds Shooter with 3-stage enterable buildings, unlimited backpack, dual-slot weapons, custom HUD layout editor, and two-team squad rooms.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#020617",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
