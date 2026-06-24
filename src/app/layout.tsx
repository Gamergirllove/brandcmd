import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrandCMD — Creator Command Center",
  description:
    "Unified analytics for independent creators. Track Twitch, YouTube and more.",
  openGraph: {
    title: "BrandCMD",
    description: "Your creator command center",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ background: "#0A0A0C", color: "#E8E8E8" }}>{children}</body>
    </html>
  );
}
