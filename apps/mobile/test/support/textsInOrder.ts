import type { screen } from "@testing-library/react-native";

/** Expects the elements to read exactly these texts, in this order, so a column order is tested as drawn. */
export function expectTextsInOrder(
  elements: ReturnType<typeof screen.getAllByText>,
  expectedTexts: readonly string[],
) {
  expect(elements).toHaveLength(expectedTexts.length);
  expectedTexts.forEach((text, index) => {
    expect(elements[index]).toHaveTextContent(text, { exact: true });
  });
}
