import { screen } from "@testing-library/react-native";

// A host node's style is loosely typed, so a property is read with a descriptor, as in animatedStyle.
function styleValue(style: unknown, property: string): unknown {
  if (typeof style !== "object" || style === null) {
    return undefined;
  }
  return Object.getOwnPropertyDescriptor(style, property)?.value;
}

/**
 * The host views on the screen whose style has every property given. For a view that has no role to
 * query by, such as a colour mark or a field's box, so it is found by the look it was drawn with.
 */
export function viewsDrawn(style: Record<string, unknown>) {
  return (
    screen.root?.queryAll(
      (node) =>
        typeof node.type === "string" &&
        Object.entries(style).every(
          ([property, value]) => styleValue(node.props.style, property) === value,
        ),
    ) ?? []
  );
}
