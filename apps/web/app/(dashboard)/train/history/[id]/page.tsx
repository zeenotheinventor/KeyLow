import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { SessionDetailScreen } from "@/components/train/SessionDetailScreen";

// A history row, a logged day of the week strip and the Done card's View session open this page. The Train
// home's two say so with `?from=train`, which the Back link is named for. Train stays current in the top bar.
export default async function TrainSessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);

  return (
    <PageFrame variant="diary">
      <SessionDetailScreen id={id} origin={from === "train" ? "train" : "history"} />
    </PageFrame>
  );
}
