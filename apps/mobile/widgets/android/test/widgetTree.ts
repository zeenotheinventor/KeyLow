import { buildWidgetTree } from "react-native-android-widget/src/api/build-widget-tree";

import type { ReactElement } from "react";
import type { WidgetTree } from "react-native-android-widget/src/api/build-widget-tree";

/*
 * The library's primitives render nothing under React Native Testing Library (`TextWidget` and `SvgWidget`
 * return null), so a widget is read the way the launcher receives it: the tree `buildWidgetTree` makes from
 * the layout. Its props are the converted ones, so a colour is `#RRGGBB` and a tap is `clickAction` data.
 */

export type { WidgetTree };

export const treeOf = (element: ReactElement): WidgetTree => buildWidgetTree(element);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const nodesOf = (tree: WidgetTree): WidgetTree[] => [
  tree,
  ...(tree.children ?? []).flatMap(nodesOf),
];

const propOf = (node: WidgetTree, name: string): unknown =>
  isRecord(node.props) ? node.props[name] : undefined;

export const textsOf = (tree: WidgetTree): string[] =>
  nodesOf(tree).flatMap((node) => {
    const text = propOf(node, "text");

    return node.type === "TextWidget" && typeof text === "string" ? [text] : [];
  });

export const svgsOf = (tree: WidgetTree): string[] =>
  nodesOf(tree).flatMap((node) => {
    const svg = propOf(node, "svgString");

    return typeof svg === "string" ? [svg] : [];
  });

/** The `uri` of every OPEN_URI tap in the tree, with the accessibility label of the node that carries it. */
export const taps = (tree: WidgetTree): { label: string | undefined; uri: string }[] =>
  nodesOf(tree).flatMap((node) => {
    const data = propOf(node, "clickActionData");
    const label = propOf(node, "accessibilityLabel");
    if (propOf(node, "clickAction") !== "OPEN_URI" || !isRecord(data)) {
      return [];
    }

    return typeof data.uri === "string"
      ? [{ label: typeof label === "string" ? label : undefined, uri: data.uri }]
      : [];
  });

export const colourOfText = (tree: WidgetTree, text: string): unknown => {
  const node = nodesOf(tree).find((candidate) => propOf(candidate, "text") === text);

  return node === undefined ? undefined : propOf(node, "color");
};

export const backgroundColours = (tree: WidgetTree): unknown[] =>
  nodesOf(tree).flatMap((node) => {
    const colour = propOf(node, "backgroundColor");

    return colour === undefined ? [] : [colour];
  });
