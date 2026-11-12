import { Fragment } from "react";

import { Text } from "../Text";

import type { ReplySpansProps } from "./types";

/**
 * The words of a reply line or table cell, with their bold and italic. Italic is the `italic` class on Geist
 * Regular, because the app bundles no italic face, and code stays in Geist, because it bundles no mono face.
 * A span with no style is plain words.
 */
export function ReplySpans({
  spans,
  isHeading = false,
  isCaption = false,
  tone = "primary",
}: ReplySpansProps) {
  return spans.map((span, index) => {
    if (!span.isStrong && !span.isEmphasis) {
      return <Fragment key={index}>{span.text}</Fragment>;
    }
    const variant = isCaption ? "caption" : span.isStrong || isHeading ? "body-strong" : "body";
    return (
      <Text key={index} className={span.isEmphasis ? "italic" : ""} tone={tone} variant={variant}>
        {span.text}
      </Text>
    );
  });
}
