import { View } from "react-native";

import { Text } from "../Text";
import { ActionMenuItem } from "./ActionMenuItem";

import type { ActionMenuProps } from "./types";

/**
 * A list of actions, such as the menu behind the diary's More button: an optional title over rows of an icon,
 * a label and a caption. It draws no surface of its own: a screen puts it in a bottom sheet, which brings the
 * dim, the handle and the way to close it. The screen closes the sheet when an item is pressed.
 */
export function ActionMenu({ title, items }: ActionMenuProps) {
  return (
    <View>
      {title === undefined ? null : (
        <Text className="mb-3" role="heading" variant="h2">
          {title}
        </Text>
      )}
      {items.map((item) => (
        <ActionMenuItem key={item.label} {...item} />
      ))}
    </View>
  );
}
