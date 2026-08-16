import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SettingsProvider } from "@/lib/settings-context";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Analytical Lab Logbook — Instrument Daily Use Record",
  description: "Electronic instrument logbook for analytical laboratories.",
  // Internal tool: keep it out of search engines and link previews entirely.
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const themeInitScript = `(function(){try{
  var t=localStorage.getItem('lab-theme');
  if(t!=='light'&&t!=='dark'){t='light';}
  document.documentElement.dataset.theme=t;
  var s=localStorage.getItem('lab-font-size');
  if(s){document.documentElement.dataset.fontSize=s;}
}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The middleware mints a per-request nonce and puts it in the CSP; the theme
  // script has to carry the same one to be allowed to run.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
