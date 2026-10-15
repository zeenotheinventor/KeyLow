import { Text as NativeText } from "react-native";

import { useTheme } from "../../../../lib/theme";

import type { CheckboxLinkProps } from "./types";

/**
 * A link inside a checkbox's label, such as the sign-up screen's Terms. It is drawn at the label's
 * 14 over 20 in regular weight, which the kit's `Text` cannot be nested at because its variants set
 * their own size. It is underlined in the design's `accent-ink`: lime in dark and the primary text
 * colour in light, where lime is too faint for text. The tab bar picks the same two classes. It handles
 * its own press, so the checkbox does not toggle.
 */
export function CheckboxLink({ children, onPress }: CheckboxLinkProps) {
  const { scheme } = useTheme();
  const inkClassName = scheme === "dark" ? "text-accent" : "text-text-primary";

  return (
    <NativeText
      className={`font-normal tabular-nums tracking-normal underline !text-[14px] leading-[20px] ${inkClassName}`}
      role="link"
      onPress={onPress}
    >
      {children}
    </NativeText>
  );
}
