import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { MuscleListScreen } from "@/components/body/MuscleListScreen";
import { MUSCLE_LIST_DAY_PARAMETER } from "@/lib/bodyMapRoutes";

type MuscleListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The body map's Muscle list row opens this page. The address carries only the day on the map (`?at=`), and
// the screen takes it only when it is a day of this week.
export default async function MuscleListPage({ searchParams }: MuscleListPageProps) {
  const at = (await searchParams)[MUSCLE_LIST_DAY_PARAMETER];

  return (
    <PageFrame variant="diary">
      <MuscleListScreen at={typeof at === "string" ? at : undefined} />
    </PageFrame>
  );
}
