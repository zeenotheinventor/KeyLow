import type { ReactNode } from "react";

import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { GoalFlow } from "@/components/goals";

// The dashboard layout above already covers these routes with the sign in and the terms gate. The flow is
// not in the top bar. The Goal row of More opens its first address, the Goal page. The answers live in the
// flow for as long as this layout does, so Back keeps them and leaving the flow drops them. The frame is
// here, so the skeleton the flow draws while the goal is read sits where the pages do.
export default function GoalLayout({ children }: { children: ReactNode }) {
  return (
    <PageFrame variant="diary">
      <GoalFlow>{children}</GoalFlow>
    </PageFrame>
  );
}
