import { AUTH_SCREEN } from "@keylow/core/copy";
import Image from "next/image";

import type { GoogleButtonProps } from "./types";

import { Button } from "@/components/ui/Button";

export function GoogleButton({ loading, disabled, onClick }: GoogleButtonProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      loading={loading}
      loadingLabel="Opening Google"
      disabled={disabled}
      onClick={onClick}
      className="gap-3"
    >
      <Image src="/brand/google-g.svg" alt="" width={20} height={20} unoptimized />
      {AUTH_SCREEN.googleButton}
    </Button>
  );
}
