import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meme T-Shirt Eshop",
  description: "A meme t-shirt eshop built with Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
