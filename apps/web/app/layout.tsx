import { Geist } from "next/font/google";
import { cookies } from "next/headers";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

import { LegalFooter } from "@/components/legal/LegalFooter";
import { THEME_COOKIE_NAME, themeFromCookie } from "@/lib/theme/themeCookie";

// Self-hosted at build time. The preset's font stack reaches it through --font-geist.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Ki-Lo",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const theme = themeFromCookie(cookieStore.get(THEME_COOKIE_NAME)?.value);

  return (
    <html lang="en" data-theme={theme} className={geist.variable}>
      <body className="flex min-h-dvh flex-col">
        {children}
        <LegalFooter />
      </body>
    </html>
  );
}
