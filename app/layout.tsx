import type { Metadata } from "next";
import "./globals.css";
import { ConsentBanner } from "./lib/ConsentBanner.tsx";
import { siteName, siteUrl } from "./lib/site-config.ts";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteName,
  description:
    "Meme-inspired t-shirts and apparel, printed on demand. Browse the catalog, find your favorite design, and check out securely.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <ConsentBanner />
      </body>
    </html>
  );
}
