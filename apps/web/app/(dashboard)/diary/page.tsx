import { PageFrame } from "../PageFrame";

import { DiaryScreen } from "@/components/diary";
import { parseDiaryDate, parseDiaryView } from "@/lib/diary";

type DiaryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DiaryPage({ searchParams }: DiaryPageProps) {
  const { date, view } = await searchParams;

  return (
    <PageFrame variant="diary">
      <DiaryScreen date={parseDiaryDate(date)} view={parseDiaryView(view)} />
    </PageFrame>
  );
}
