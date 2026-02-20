import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Instrument_Sans } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nesema — Health, felt whole.",
    template: "%s | Nesema",
  },
  description:
    "Connect with specialist holistic health practitioners. Functional nutrition, physiotherapy, sleep coaching, and more.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nesema",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    siteName: "Nesema",
    title: "Nesema — Health, felt whole.",
    description:
      "Connect with specialist holistic health practitioners. Functional nutrition, physiotherapy, sleep coaching, and more.",
    images: [{ url: "/og-image.svg", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nesema — Health, felt whole.",
    description:
      "Connect with specialist holistic health practitioners. Functional nutrition, physiotherapy, sleep coaching, and more.",
    images: ["/og-image.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#2A2118",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${instrumentSans.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body className="antialiased font-sans bg-nesema-bg text-nesema-t1">
        {children}
      </body>
    </html>
  );
}
