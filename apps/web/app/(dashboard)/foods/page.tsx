import { BarcodeLookup } from "@/components/foods/BarcodeLookup";
import { FoodSearch } from "@/components/foods/FoodSearch";

export default function FoodsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Foods</h1>
      <FoodSearch />
      <BarcodeLookup />
    </div>
  );
}
