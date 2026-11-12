"use client";

import { PROGRAM_ERROR } from "@keylow/core/copy";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ProgramEditForm } from "./ProgramEditForm";
import { ProgramEditFrame } from "./ProgramEditFrame";
import { ProgramEditLoading } from "./ProgramEditLoading";
import { useProgramEditRead } from "./useProgramEditRead";

import { ErrorState } from "@/components/ui/ErrorState";
import { useNow } from "@/lib/useNow";

const PROGRAM_HREF = "/more/program";

/**
 * The Edit programme page, reached from the Programme page's actions card: the form, or the loading and error
 * boards under the same title. Opened with no programme it goes to the Programme page, which offers one. The reads
 * failing online is the error board with Try again, and with nothing read offline it is the same board with no
 * Try again, which would do nothing: the read goes ahead by itself when the connection returns.
 */
export function ProgramEditScreen() {
  const router = useRouter();
  const read = useProgramEditRead(useNow());
  const isWithoutProgramme = read.status === "no-program";

  useEffect(() => {
    if (isWithoutProgramme) {
      router.replace(PROGRAM_HREF);
    }
  }, [isWithoutProgramme, router]);

  switch (read.status) {
    case "ready":
      return <ProgramEditForm {...read.form} />;
    case "error":
      return (
        <ProgramEditFrame>
          {read.retry === undefined ? (
            <ErrorState title={PROGRAM_ERROR.title} body={PROGRAM_ERROR.body} size="page" />
          ) : (
            <ErrorState
              title={PROGRAM_ERROR.title}
              body={PROGRAM_ERROR.body}
              retryLabel={PROGRAM_ERROR.retryLabel}
              size="page"
              onRetry={read.retry}
            />
          )}
        </ProgramEditFrame>
      );
    case "loading":
    case "no-program":
      return (
        <ProgramEditFrame>
          <ProgramEditLoading />
        </ProgramEditFrame>
      );
  }
}
