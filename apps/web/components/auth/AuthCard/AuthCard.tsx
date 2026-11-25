import type { AuthCardProps } from "./types";

import { Card } from "@/components/ui/Card";
import { KiLoMark } from "@/components/ui/KiLoMark";

/** The page frame of the sign in, forgot password and reset link pages: one centred card with the mark and the heading. */
export function AuthCard({ heading, caption, children }: AuthCardProps) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-6">
      <Card padding="none" className="flex w-full max-w-md flex-col gap-4 p-6 sm:p-8">
        {heading !== undefined && (
          <div className="mb-1 flex flex-col items-start gap-3">
            <KiLoMark className="size-12" />
            <div className="flex flex-col gap-2">
              <h1 className="text-h1">{heading}</h1>
              {caption !== undefined && <p className="text-body text-text-secondary">{caption}</p>}
            </div>
          </div>
        )}
        {children}
      </Card>
    </main>
  );
}
