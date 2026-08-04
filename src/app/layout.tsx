import type { Metadata } from "next";
import { Archivo, DM_Mono, Instrument_Sans } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

/** Archivo variable wdth axis at 62 — closest to Archivo Condensed in next/font. */
const archivoDisplay = Archivo({
  subsets: ["latin"],
  weight: "variable",
  axes: ["wdth"],
  variable: "--font-archivo-condensed",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: "Playbook School",
  description: "Upload your playbook. Every player gets a tutor that drills them on their assignment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivoDisplay.variable} ${instrumentSans.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
