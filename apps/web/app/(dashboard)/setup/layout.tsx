import type { ReactNode } from "react";

import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { SetupFlow } from "@/components/setup";

// The dashboard layout above already covers these routes with the sign in and the terms gate. The wizard is a
// page in the signed in shell, in the column the goal questionnaire uses. The answers live in the flow for as
// long as this layout does, so Back keeps them and leaving the wizard drops them. The frame is here, so the
// skeleton the flow draws while the saved answers are read sits where the steps do.
export default function SetupLayout({ children }: { children: ReactNode }) {
  return (
    <PageFrame variant="diary">
      <SetupFlow>{children}</SetupFlow>
    </PageFrame>
  );
}
