import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rang De",
  description: "Rang De",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Inter at the three weights in tokens.css (500, 700, 900). */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700;900&display=swap"
        />
      </head>
      <body className="bg-white-100">{children}</body>
    </html>
  );
}
