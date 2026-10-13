"use client";

import { useFood, useFoodPortions } from "@keylow/api-client";

import { FoodForm } from "@/components/foods/FoodForm";

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">{children}</div>;
}

function LoadFailure({ message }: { message: string }) {
  return (
    <Notice>
      <p role="alert" className="text-sm text-danger">
        {message}
      </p>
    </Notice>
  );
}

export function EditFoodScreen({ id }: { id: string }) {
  const food = useFood(id);
  const portions = useFoodPortions(id);

  // A failed background refetch must not replace a form the user may be editing, so an error only
  // takes over the screen when there is no data to show.
  if (food.data === undefined && food.isError) {
    return <LoadFailure message={food.error.message} />;
  }
  if (portions.data === undefined && portions.isError) {
    return <LoadFailure message={portions.error.message} />;
  }

  if (food.data === undefined || portions.data === undefined) {
    return (
      <Notice>
        <p role="status" className="text-sm text-text-muted">
          Loading food
        </p>
      </Notice>
    );
  }

  if (food.data === null) {
    return (
      <Notice>
        <h1 className="text-2xl font-semibold">Food not found</h1>
        <p className="text-sm text-text-muted">
          This food does not exist, or it is not one you can see.
        </p>
      </Notice>
    );
  }

  if (food.data.source !== "user") {
    return (
      <Notice>
        <p className="text-sm text-text-muted">
          This food comes from a shared database and cannot be edited.
        </p>
      </Notice>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Edit food</h1>
      <FoodForm existing={{ food: food.data, portions: portions.data }} />
    </div>
  );
}
