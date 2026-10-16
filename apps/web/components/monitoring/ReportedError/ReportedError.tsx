"use client";

import { GENERIC_ERROR } from "@keylow/core/copy";
import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";

import type { ReportedErrorProps } from "./types";

import { ErrorState } from "@/components/ui/ErrorState";

/** What an error boundary shows: the generic sentence, never the failure, which can quote health data. */
export function ReportedError({ error, reset }: ReportedErrorProps) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return <ErrorState headingLevel={1} size="page" body={GENERIC_ERROR} onRetry={reset} />;
}
