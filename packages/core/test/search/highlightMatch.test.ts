import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { highlightMatch } from "../../src/search";

describe("highlightMatch", () => {
  it("should mark each query word that starts a word of the name", () => {
    expect(highlightMatch("Chicken, breast, grilled", "chicken breast")).toEqual([
      { text: "Chicken", matched: true },
      { text: ", ", matched: false },
      { text: "breast", matched: true },
      { text: ", grilled", matched: false },
    ]);
  });

  it("should match without regard to case and keep the case of the name", () => {
    expect(highlightMatch("Stock Cubes", "STOCK")).toEqual([
      { text: "Stock", matched: true },
      { text: " Cubes", matched: false },
    ]);
  });

  it("should mark only the start of a word when the query word is a prefix", () => {
    expect(highlightMatch("Chicken Stock", "chi")).toEqual([
      { text: "Chi", matched: true },
      { text: "cken Stock", matched: false },
    ]);
  });

  it("should not mark a query word found in the middle of a word", () => {
    expect(highlightMatch("Chicken", "ick")).toEqual([{ text: "Chicken", matched: false }]);
  });

  it("should mark every word of the name that a query word starts", () => {
    expect(highlightMatch("Apple apple pie", "app")).toEqual([
      { text: "App", matched: true },
      { text: "le ", matched: false },
      { text: "app", matched: true },
      { text: "le pie", matched: false },
    ]);
  });

  it("should join marked words that touch into one segment", () => {
    expect(highlightMatch("Oat Meal", "oat meal")).toEqual([
      { text: "Oat", matched: true },
      { text: " ", matched: false },
      { text: "Meal", matched: true },
    ]);
  });

  it("should prefer the longest query word when two start at the same place", () => {
    expect(highlightMatch("Chicken", "chi chicken")).toEqual([{ text: "Chicken", matched: true }]);
  });

  it("should return the whole name unmarked for an empty query", () => {
    expect(highlightMatch("Chicken breast", "")).toEqual([
      { text: "Chicken breast", matched: false },
    ]);
  });

  it("should return the whole name unmarked for a query of only spaces", () => {
    expect(highlightMatch("Chicken breast", "   ")).toEqual([
      { text: "Chicken breast", matched: false },
    ]);
  });

  it("should ignore single letter query words, which would mark noise", () => {
    expect(highlightMatch("Apple a day", "a")).toEqual([{ text: "Apple a day", matched: false }]);
  });

  it("should return no segments for an empty name", () => {
    expect(highlightMatch("", "chicken")).toEqual([]);
  });

  it("should treat regular expression characters in the query as plain text", () => {
    expect(highlightMatch("Mars (bar) [milk]", "(bar")).toEqual([
      { text: "Mars (bar) [milk]", matched: false },
    ]);
    expect(highlightMatch("Chicken", ".*")).toEqual([{ text: "Chicken", matched: false }]);
    expect(highlightMatch("C++ chips", "c++")).toEqual([
      { text: "C++", matched: true },
      { text: " chips", matched: false },
    ]);
  });

  it("should match a word that follows punctuation", () => {
    expect(highlightMatch("Soup (tomato)", "tomato")).toEqual([
      { text: "Soup (", matched: false },
      { text: "tomato", matched: true },
      { text: ")", matched: false },
    ]);
  });

  it("should match a word that starts with a digit", () => {
    expect(highlightMatch("2% milk", "2%")).toEqual([
      { text: "2%", matched: true },
      { text: " milk", matched: false },
    ]);
  });

  it("should never throw and always give the name back when the segments are joined", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: "grapheme" }),
        fc.string({ unit: "grapheme" }),
        (name, query) => {
          const segments = highlightMatch(name, query);

          expect(segments.map((segment) => segment.text).join("")).toBe(name);
          for (const segment of segments) {
            expect(segment.text).not.toBe("");
          }
        },
      ),
    );
  });

  it("should alternate between marked and unmarked segments", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (name, query) => {
        const segments = highlightMatch(name, query);

        segments.slice(1).forEach((segment, index) => {
          expect(segment.matched).not.toBe(segments[index]?.matched);
        });
      }),
    );
  });
});
