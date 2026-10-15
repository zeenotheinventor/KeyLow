import Link from "next/link";

import { authLinkClass } from "../authLink";

import type { AuthSwitchLinkProps } from "./types";

/** The line under an auth card that points to the other auth page. */
export function AuthSwitchLink({ prompt, linkLabel, href }: AuthSwitchLinkProps) {
  return (
    <p className="text-caption text-text-secondary">
      {prompt}{" "}
      <Link href={href} className={authLinkClass}>
        {linkLabel}
      </Link>
    </p>
  );
}
