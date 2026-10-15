import { LEGAL_URLS, SIGN_UP_ACCEPTANCE } from "@keylow/core/copy";
import { Linking } from "react-native";

import { Checkbox, CheckboxLink } from "../ui";

import type { AcceptanceCheckboxProps } from "./types";

function openPage(url: string) {
  // A device with no browser rejects, and there is nothing else to do about it, so the screen stays as it is.
  Linking.openURL(url).catch(() => undefined);
}

/**
 * The sign up board's checkbox: the acceptance sentence, with the Terms and the Privacy Policy as links
 * that open the web app's two pages. Pressing a link opens the page and leaves the box as it is.
 */
export function AcceptanceCheckbox({ checked, onChange }: AcceptanceCheckboxProps) {
  return (
    <Checkbox
      checked={checked}
      label={
        <>
          {SIGN_UP_ACCEPTANCE.beforeTerms}
          <CheckboxLink
            onPress={() => {
              openPage(LEGAL_URLS.terms);
            }}
          >
            {SIGN_UP_ACCEPTANCE.termsLink}
          </CheckboxLink>
          {SIGN_UP_ACCEPTANCE.betweenLinks}
          <CheckboxLink
            onPress={() => {
              openPage(LEGAL_URLS.privacy);
            }}
          >
            {SIGN_UP_ACCEPTANCE.privacyLink}
          </CheckboxLink>
          {SIGN_UP_ACCEPTANCE.afterPrivacy}
        </>
      }
      onChange={onChange}
    />
  );
}
