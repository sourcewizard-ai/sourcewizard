import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "./providers/AuthProvider";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const nineties = localFont({
  src: "../public/90s-font.ttf",
  variable: "--font-90s",
});

const vtfont = localFont({
  src: "../public/vt323.ttf",
  variable: "--font-vt",
});

const ismeriaFont = localFont({
  src: "../public/ishmeria.ttf",
  variable: "--font-ismeria",
});

const vollkornFont = localFont({
  src: "../public/Vollkorn-Regular.ttf",
  variable: "--font-vollkorn",
});

const chikaregoFont = localFont({
  src: "../public/ChiKareGo2.ttf",
  variable: "--font-chikarego",
});

export const metadata: Metadata = {
  title: "SourceWizard - Setup Wizard For DevTools",
  description: "AI Setup Agent for libraries, SDKs and tools",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${nineties.variable} ${vtfont.variable} ${ismeriaFont.variable} ${chikaregoFont.variable} ${vollkornFont.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
