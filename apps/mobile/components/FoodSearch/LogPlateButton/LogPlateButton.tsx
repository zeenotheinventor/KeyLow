import { PLATE, describeLogPlateAction, describeLogPlateActionName } from "@keylow/core/copy";

import { usePlate, useLogPlate } from "../../../lib/plate";
import { Button, useToast } from "../../ui";

import type { LogPlateButtonProps } from "./types";

/**
 * "Log food" or "Log foods", docked beside the search field: it appears with the first food on the plate and
 * goes with the last. It writes the plate. While that runs it shows a spinner, and offline it is dimmed
 * and cannot be pressed, because the plate needs a connection to be logged. When the write fails the plate is
 * kept and a toast says so. On success `useLogPlate` takes the person to the diary.
 */
export function LogPlateButton({ context }: LogPlateButtonProps) {
  const { count, canLog, isLogging } = usePlate();
  const { logPlate } = useLogPlate(context);
  const toast = useToast();

  if (count === 0) {
    return null;
  }

  return (
    <Button
      accessibilityLabel={describeLogPlateActionName(count)}
      // The logging board draws the spinner at full strength, so a log in progress is not dimmed.
      disabled={!canLog && !isLogging}
      loading={isLogging}
      onPress={() => {
        void logPlate().then((result) => {
          if (!result.ok && result.wasIgnored !== true) {
            toast.show({ message: PLATE.notLogged, tone: "danger", icon: "CircleAlert" });
          }
        });
      }}
    >
      {describeLogPlateAction(count)}
    </Button>
  );
}
