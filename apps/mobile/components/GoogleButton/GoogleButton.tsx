import { AUTH_SCREEN } from "@keylow/core/copy";

import { GoogleMark } from "../GoogleMark";
import { Button } from "../ui";

import type { GoogleButtonProps } from "./types";

/** The large secondary button of the sign in boards, with the Google "G" before its label. */
export function GoogleButton({ disabled = false, onPress }: GoogleButtonProps) {
  return (
    <Button
      disabled={disabled}
      fullWidth
      leading={<GoogleMark />}
      size="lg"
      variant="secondary"
      onPress={onPress}
    >
      {AUTH_SCREEN.googleButton}
    </Button>
  );
}
