"use client";

import { useRouter } from "next/navigation";

import { RoutinesScreen } from "../RoutinesScreen";

import { trainRoutineEditPath, trainRoutineNewPath } from "@/lib/trainRoutes";

/** The routines page with its buttons wired: New routine and Create routine open the new routine's editor, and a routine opens its own. */
export function RoutinesRoute() {
  const router = useRouter();

  return (
    <RoutinesScreen
      onCreateRoutine={() => {
        router.push(trainRoutineNewPath());
      }}
      onEditRoutine={({ id }) => {
        router.push(trainRoutineEditPath(id));
      }}
    />
  );
}
