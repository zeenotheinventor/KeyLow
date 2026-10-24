import { screen } from "@testing-library/react-native";

/** Every text and accessible name on the screen, in the order they are drawn, so an order down the screen is tested as drawn. */
export function screenWords(): string[] {
  const words: string[] = [];
  const visit = (node: unknown) => {
    if (typeof node === "string") {
      words.push(node);
    } else if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (typeof node === "object" && node !== null) {
      const props: unknown = "props" in node ? node.props : undefined;
      const children: unknown = "children" in node ? node.children : undefined;
      if (typeof props === "object" && props !== null) {
        for (const name of ["aria-label", "accessibilityLabel"]) {
          const label: unknown = Object.getOwnPropertyDescriptor(props, name)?.value;
          if (typeof label === "string") {
            words.push(label);
          }
        }
      }
      visit(children);
    }
  };
  visit(screen.toJSON());

  return words;
}
