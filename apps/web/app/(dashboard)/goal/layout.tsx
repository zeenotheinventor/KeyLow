import type { ReactNode } from "react";

import { GoalFlow } from "@/components/goals";

// The dashboard layout above already covers these routes with the sign in and the terms gate. The flow is
// not in the top bar. The Goal row of More opens it. The answers live in the flow for as long as this layout
// does, so Back keeps them and leaving the flow drops them.
export default function GoalLayout({ children }: { children: ReactNode }) {
  return <GoalFlow>{children}</GoalFlow>;
}
