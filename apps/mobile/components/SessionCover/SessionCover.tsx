import { View } from "react-native";

import { KiLoMark } from "../KiLoMark";

const markSize = 112;

/**
 * What covers the app while the stored session is read, as the tab shell's session-loading board draws it:
 * the Ki-Lo mark alone, centred at 112 points on the background. The mark is decoration, so the cover is
 * what is announced.
 */
export function SessionCover() {
  return (
    <View
      accessible
      aria-label="Ki-Lo"
      className="absolute inset-0 items-center justify-center bg-background"
      role="img"
    >
      <KiLoMark size={markSize} />
    </View>
  );
}
