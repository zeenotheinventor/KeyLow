import { assertEquals } from "@std/assert";

import { readAmrClaim } from "./auth.ts";

const encode = (value: unknown) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

const tokenWith = (payload: unknown) => `${encode({ alg: "ES256" })}.${encode(payload)}.signature`;

Deno.test("readAmrClaim returns the amr of a well-formed token", () => {
  const amr = [{ method: "password", timestamp: 1_800_000_000 }];

  assertEquals(readAmrClaim(tokenWith({ sub: "someone", amr })), amr);
});

Deno.test(
  "readAmrClaim decodes a payload that needs base64url padding and the url alphabet",
  () => {
    // A value whose base64 holds "+" and "/", which base64url writes as "-" and "_".
    const amr = [{ method: "password", timestamp: 1, note: "???>>>~~~" }];

    assertEquals(readAmrClaim(tokenWith({ amr })), amr);
  },
);

Deno.test("readAmrClaim returns undefined when the payload has no amr", () => {
  assertEquals(readAmrClaim(tokenWith({ sub: "someone" })), undefined);
});

Deno.test("readAmrClaim returns undefined, without throwing, for a token it cannot decode", () => {
  const notAnObject = `${encode({})}.${encode("text")}.signature`;
  const badJson = `${encode({})}.${btoa("{not json").replaceAll("=", "")}.signature`;

  for (const token of [
    "",
    "one",
    "one.two",
    "a.b.c.d",
    "header.%%%.signature",
    "header.!!!!.signature",
    badJson,
    notAnObject,
  ]) {
    assertEquals(readAmrClaim(token), undefined);
  }
});
