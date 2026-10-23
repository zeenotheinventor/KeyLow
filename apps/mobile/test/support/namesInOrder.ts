import type { screen } from "@testing-library/react-native";

/** Expects the elements to have exactly these accessible names, in this order, so a list is tested as it is read. */
export function expectAccessibleNamesInOrder(
  elements: ReturnType<typeof screen.getAllByRole>,
  expectedNames: readonly string[],
) {
  expect(elements).toHaveLength(expectedNames.length);
  expectedNames.forEach((name, index) => {
    expect(elements[index]).toHaveAccessibleName(name);
  });
}
