import { BookOpen } from "lucide-react";

import { ComingSoon } from "../ComingSoon";
import { PageFrame } from "../PageFrame";

export default function DiaryPage() {
  return (
    <PageFrame variant="shell">
      <ComingSoon
        title="Diary"
        icon={BookOpen}
        body="Your logged foods will appear here, day by day."
      />
    </PageFrame>
  );
}
