import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meme T-Shirt Eshop",
  description: "A storefront for meme t-shirts",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
