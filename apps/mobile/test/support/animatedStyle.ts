import { getAnimatedStyle } from "react-native-reanimated";

type AnimatedElement = Parameters<typeof getAnimatedStyle>[0];

// Reanimated types an animated style loosely, so the transform is read as unknown and narrowed.
function transformValue(element: AnimatedElement, key: "scale" | "rotate"): unknown {
  const { transform }: { transform?: unknown } = getAnimatedStyle(element);
  if (!Array.isArray(transform)) {
    return undefined;
  }
  for (const entry of transform) {
    const candidate: unknown = entry;
    if (typeof candidate === "object" && candidate !== null) {
      const value: unknown = Object.getOwnPropertyDescriptor(candidate, key)?.value;
      if (value !== undefined) {
        return value;
      }
    }
  }
  return undefined;
}

/** The scale in an element's animated style, or undefined when it has none. */
export function animatedScale(element: AnimatedElement): number | undefined {
  const value = transformValue(element, "scale");
  return typeof value === "number" ? value : undefined;
}

/** The rotation, such as "90deg", in an element's animated style, or undefined when it has none. */
export function animatedRotation(element: AnimatedElement): string | undefined {
  const value = transformValue(element, "rotate");
  return typeof value === "string" ? value : undefined;
}
