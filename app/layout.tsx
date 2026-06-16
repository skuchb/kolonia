import type { Metadata } from "next";
import Analytics from "@/src/components/kolonia/Analytics";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kolonia.gg";

export const metadata: Metadata = {
  title: "KOLONIA — codzienna zagadka z Górniczej Doliny",
  description:
    "Jedna postać, jeden cytat, jedno miejsce. Codzienna gra-zagadka dla fanów Gothica. Reset o północy.",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    alternateLocale: ["en_US", "de_DE"],
    url: "/",
    siteName: "KOLONIA",
    title: "KOLONIA — codzienna zagadka z Górniczej Doliny",
    description:
      "Zgadnij dzisiejszego NPC-a po atrybutach albo po cytacie. Darmowa gra fanowska, reset o północy.",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "KOLONIA — codzienna zagadka z Górniczej Doliny",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KOLONIA — codzienna zagadka z Górniczej Doliny",
    description:
      "Zgadnij dzisiejszego NPC-a po atrybutach albo po cytacie. Darmowa gra fanowska, reset o północy.",
    images: ["/og.svg"],
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
        <Analytics />
      </body>
    </html>
  );
}
