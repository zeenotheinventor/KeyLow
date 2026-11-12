// On a phone the calories column is one and a half times a macro column, 8 px apart. From 768 px the four
// are equal, 24 px apart. On a card the columns size to their numbers, 8 px apart, from 1024 px, where the
// plate is a column beside the results. Below that the plate is a step of the dialog and the four sit two by
// two, 12 px apart. Each class is written out whole so Tailwind can see it.
export const pageColumnsClassName =
  "grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] gap-2 md:grid-cols-[repeat(4,minmax(0,1fr))] md:gap-6";
export const cardColumnsClassName =
  "grid-cols-[repeat(2,minmax(0,1fr))] gap-3 min-[1024px]:grid-cols-[repeat(4,auto)] min-[1024px]:gap-2";
