import { FoodSearch } from "@/components/foods/FoodSearch";

type FoodsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FoodsPage({ searchParams }: FoodsPageProps) {
  const { scope, panel } = await searchParams;
  const resolvedScope = scope === "own" ? "own" : "all";
  const startWithBarcodePanel = panel === "barcode";

  // A change of either parameter is a new page, so the search starts again from its start state.
  return (
    <FoodSearch
      key={`${resolvedScope}-${String(startWithBarcodePanel)}`}
      scope={resolvedScope}
      startWithBarcodePanel={startWithBarcodePanel}
    />
  );
}
