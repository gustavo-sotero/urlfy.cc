import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SkipLink } from "@/components/layout/skip-link";
import { Providers } from "@/lib/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "urlfy.cc - URL Shortener",
  description: "Fast and reliable URL shortening service with analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SkipLink />
        <Providers>
          <div id="main-content">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
