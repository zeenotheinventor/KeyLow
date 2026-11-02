import { assert, assertFalse } from "@std/assert";

import { urlInUserMessage } from "./urls.ts";

Deno.test("a url that appears verbatim in the message matches", () => {
  assert(
    urlInUserMessage("https://example.com/a-recipe", "Save https://example.com/a-recipe please"),
  );
});

Deno.test("trailing punctuation after the url in the message is ignored", () => {
  for (const ending of [".", ",", "!", "?", ")", ";", ":", '"']) {
    assert(
      urlInUserMessage(
        "https://example.com/a-recipe",
        `Can you import https://example.com/a-recipe${ending}`,
      ),
      `ending ${ending}`,
    );
  }
});

Deno.test("a url that is only part of a longer address does not match", () => {
  assertFalse(urlInUserMessage("https://example.com/a", "Save https://example.com/a-recipe"));
  assertFalse(urlInUserMessage("https://example.com/a-recipe", "Save https://example.com/a"));
});

Deno.test("a url the user did not write does not match", () => {
  assertFalse(urlInUserMessage("https://evil.test/x", "Save https://example.com/a-recipe"));
});

Deno.test("the match is exact, so a different case or scheme does not match", () => {
  assertFalse(urlInUserMessage("https://EXAMPLE.com/a-recipe", "https://example.com/a-recipe"));
  assertFalse(urlInUserMessage("http://example.com/a-recipe", "https://example.com/a-recipe"));
});

Deno.test("an address that really ends in a bracket still matches", () => {
  assert(
    urlInUserMessage(
      "https://en.wikipedia.org/wiki/Soup_(food)",
      "Use https://en.wikipedia.org/wiki/Soup_(food)",
    ),
  );
});

Deno.test("an empty url never matches", () => {
  assertFalse(urlInUserMessage("", "anything at all"));
});
