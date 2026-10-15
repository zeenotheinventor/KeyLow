import { useId } from "react";

import type { DataSourceCreditProps } from "./types";

import { Card } from "@/components/ui/card";

/** One source's credit on a card: its name, the statement its licence asks for and its address, which opens in a new tab. */
export function DataSourceCredit({ name, text, url }: DataSourceCreditProps) {
  const nameId = useId();

  return (
    <Card asChild>
      <section aria-labelledby={nameId} className="flex flex-col gap-2">
        <h3 id={nameId} className="text-body-strong">
          {name}
        </h3>
        <p className="text-body text-text-secondary">{text}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-touch-target items-center break-all rounded-small text-caption text-text-secondary underline outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {url}
        </a>
      </section>
    </Card>
  );
}
