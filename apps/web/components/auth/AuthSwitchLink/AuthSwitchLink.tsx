import Link from "next/link";

import { authLinkClassFor } from "../authLink";

import type { AuthSwitchLinkProps } from "./types";

import { cn } from "@/lib/utils";

/** The line under an auth card that points to the other auth page. */
export function AuthSwitchLink({
  prompt,
  linkLabel,
  href,
  variant = "default",
}: AuthSwitchLinkProps) {
  const isCentred = variant === "centred";

  return (
    <p
      className={cn(
        "text-text-secondary",
        isCentred ? "flex items-center justify-center gap-1 text-body" : "text-caption",
      )}
    >
      {prompt}{" "}
      <Link
        href={href}
        className={cn(
          authLinkClassFor(isCentred ? "primary" : "accent"),
          isCentred && "inline-flex min-h-touch-target items-center px-1 font-semibold",
        )}
      >
        {linkLabel}
      </Link>
    </p>
  );
}
