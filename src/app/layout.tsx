import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SettingsProvider } from "@/lib/settings-context";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Analytical Lab Logbook — Instrument Daily Use Record",
  description: "Professional laboratory instrument logbook with supervisor review and Telegram alerts.",
};

const themeInitScript = `(function(){try{
  var t=localStorage.getItem('lab-theme');
  if(t!=='light'&&t!=='dark'){t='light';}
  document.documentElement.dataset.theme=t;
  var s=localStorage.getItem('lab-font-size');
  if(s){document.documentElement.dataset.fontSize=s;}
}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
