import { redirect } from "next/navigation";

import { goalQuestionPath } from "@/lib/goalRoutes";

// The flow's own address opens its first question.
export default function GoalPage() {
  redirect(goalQuestionPath(1));
}
