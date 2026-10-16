"use client";

import "./globals.css";

import type { ReportedErrorProps } from "@/components/monitoring/ReportedError";

import { ReportedError } from "@/components/monitoring/ReportedError";

// Replaces the root layout when that layout itself fails, so it brings its own document.
export default function GlobalError(props: ReportedErrorProps) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <ReportedError {...props} />
      </body>
    </html>
  );
}
