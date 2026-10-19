import { KeyLowProvider } from "@keylow/api-client";
import { useState } from "react";

import { createDiaryQueryClient } from "./diaryBackend";
import { trainClient } from "./trainBackend";
import { ToastProvider } from "../../components/ui";

import type { ReactNode } from "react";

/**
 * What the routine editor reads from above it: the training client its hooks use, and the toast it shows a
 * failed save in. For the tests that render the editor alone and do not save.
 */
export function EditorProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createDiaryQueryClient);

  return (
    <KeyLowProvider client={trainClient} queryClient={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </KeyLowProvider>
  );
}
