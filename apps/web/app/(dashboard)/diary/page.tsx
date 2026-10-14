import { BookOpen } from "lucide-react";

import { ComingSoon } from "../ComingSoon";

export default function DiaryPage() {
  return (
    <ComingSoon
      title="Diary"
      icon={BookOpen}
      body="Your logged foods will appear here, day by day."
    />
  );
}
