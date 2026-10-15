import { AUTH_SCREEN } from "@keylow/core/copy";

import { GoogleMark } from "../GoogleMark";
import { Button } from "../ui";

import type { GoogleButtonProps } from "./types";

/** The secondary button of the sign in boards, large unless asked otherwise, with the Google "G" before its label. */
export function GoogleButton({ disabled = false, size = "lg", onPress }: GoogleButtonProps) {
  return (
    <Button
      disabled={disabled}
      fullWidth
      leading={<GoogleMark />}
      size={size}
      variant="secondary"
      onPress={onPress}
    >
      {AUTH_SCREEN.googleButton}
    </Button>
  );
}
