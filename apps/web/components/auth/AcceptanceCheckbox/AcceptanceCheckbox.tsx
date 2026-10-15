import { LEGAL_PATHS, SIGN_UP_ACCEPTANCE } from "@keylow/core/copy";
import Link from "next/link";

import { authLinkClass } from "../authLink";

import type { AcceptanceCheckboxProps } from "./types";

import { Checkbox } from "@/components/ui/Checkbox";

// The links open a new tab so that the page the person is on is not lost.
const acceptanceLabel = (
  <>
    {SIGN_UP_ACCEPTANCE.beforeTerms}
    <Link href={LEGAL_PATHS.terms} target="_blank" rel="noreferrer" className={authLinkClass}>
      {SIGN_UP_ACCEPTANCE.termsLink}
    </Link>
    {SIGN_UP_ACCEPTANCE.betweenLinks}
    <Link href={LEGAL_PATHS.privacy} target="_blank" rel="noreferrer" className={authLinkClass}>
      {SIGN_UP_ACCEPTANCE.privacyLink}
    </Link>
    {SIGN_UP_ACCEPTANCE.afterPrivacy}
  </>
);

/** The sentence with the Terms and Privacy Policy links. The sign-up and accept-to-continue pages share it. */
export function AcceptanceCheckbox({ checked, onCheckedChange }: AcceptanceCheckboxProps) {
  return (
    <Checkbox
      multiline
      name="acceptTerms"
      label={acceptanceLabel}
      checked={checked}
      onChange={(event) => {
        onCheckedChange(event.target.checked);
      }}
    />
  );
}
