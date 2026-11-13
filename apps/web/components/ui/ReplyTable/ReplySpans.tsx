import { Fragment } from "react";

import type { ReplySpansProps } from "./types";

// Code stays in the body face, as on the phone, which bundles no mono face.
export function ReplySpans({ spans }: ReplySpansProps) {
  return spans.map((span, index) => {
    if (span.isStrong && span.isEmphasis) {
      return (
        <strong key={index}>
          <em>{span.text}</em>
        </strong>
      );
    }
    if (span.isStrong) {
      return <strong key={index}>{span.text}</strong>;
    }
    if (span.isEmphasis) {
      return <em key={index}>{span.text}</em>;
    }
    return <Fragment key={index}>{span.text}</Fragment>;
  });
}
