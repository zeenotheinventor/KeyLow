import { screen } from "@testing-library/react-native";

type Element = ReturnType<typeof screen.getByRole>;

/**
 * The view a gesture detector wraps, found from the one image on the screen by walking up to the first view that
 * the detector has marked `collapsable={false}`, which it does to the one child it attaches its gestures to.
 */
export function wrappedByGestureDetector(): Element {
  let element: Element | null = screen.getByRole("img");
  while (
    element !== null &&
    Object.getOwnPropertyDescriptor(element.props, "collapsable")?.value !== false
  ) {
    element = element.parent;
  }
  if (element === null) {
    throw new Error("No gesture detector wraps a view above the image");
  }
  return element;
}
