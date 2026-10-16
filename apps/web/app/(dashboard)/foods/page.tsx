import { isCalendarDay } from "@keylow/core/dates";

import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { FoodSearch } from "@/components/foods/FoodSearch";

type FoodsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FoodsPage({ searchParams }: FoodsPageProps) {
  const { scope, panel, day } = await searchParams;
  const resolvedScope = scope === "own" ? "own" : "all";
  const startWithBarcodePanel = panel === "barcode";
  // The day on view when the top bar's barcode button was pressed. Anything that is not a day is no day.
  const barcodeDay = typeof day === "string" && isCalendarDay(day) ? day : undefined;

  // A change of any parameter is a new page, so the search starts again from its start state.
  return (
    <PageFrame variant="foodSearch">
      <FoodSearch
        key={`${resolvedScope}-${String(startWithBarcodePanel)}-${barcodeDay ?? "today"}`}
        scope={resolvedScope}
        startWithBarcodePanel={startWithBarcodePanel}
        day={barcodeDay}
      />
    </PageFrame>
  );
}
