import type { Metadata, Viewport } from "next";
import Analytics from "@/src/components/kolonia/Analytics";
import PwaRegister from "@/src/components/kolonia/PwaRegister";
import { siteUrl } from "@/src/core/site";
import "./globals.css";

const metadataBase = siteUrl();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#12100e",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "KOLONIA — codzienna zagadka z Górniczej Doliny",
  description:
    "Codzienna gra-zagadka dla fanów Gothica (2001). Klasyczny, cytat, mapa i karta — ta sama zagadka dla wszystkich, reset o północy.",
  metadataBase: new URL(metadataBase),
  manifest: "/manifest.webmanifest",
  applicationName: "KOLONIA",
  appleWebApp: {
    capable: true,
    title: "KOLONIA",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    alternateLocale: ["en_US", "de_DE"],
    url: "/",
    siteName: "KOLONIA",
    title: "KOLONIA — codzienna zagadka z Górniczej Doliny",
    description:
      "Zgadnij postać, cytat, miejsce na mapie lub kartę NPC. Darmowa gra fanowska w trzech językach.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "KOLONIA — codzienna zagadka z Górniczej Doliny",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KOLONIA — codzienna zagadka z Górniczej Doliny",
    description:
      "Zgadnij postać, cytat, miejsce na mapie lub kartę NPC. Darmowa gra fanowska w trzech językach.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>
        {children}
        <PwaRegister />
        <Analytics />
      </body>
    </html>
  );
}
