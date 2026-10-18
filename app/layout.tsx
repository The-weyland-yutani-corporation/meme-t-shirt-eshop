import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ConsentBanner } from "./lib/ConsentBanner.tsx";
import { siteName, siteUrl } from "./lib/site-config.ts";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteName,
  description:
    "Explore original meme-inspired apparel concepts and a credential-free simulated purchase. No payment or shipment.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header>
        <div className="demo-banner">Simulation only · No payment · No shipment</div>
        <div className="site-header">
          <Link className="brand" href="/">mood.exe<span> / MEME APPAREL</span></Link>
          <nav aria-label="Main navigation">
            <Link href="/">Home</Link>
            <Link href="/catalog">Catalog</Link>
          </nav>
        </div>
        </header>
        {children}
        <footer className="site-footer"><p>mood.exe · Original artwork, simulated orders.</p><p>No personal details required. This is not a live store.</p></footer>
        <ConsentBanner />
      </body>
    </html>
  );
}
