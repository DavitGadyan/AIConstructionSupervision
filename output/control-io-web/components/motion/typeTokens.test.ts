import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { graphemes, letterCount, stepFor, textOf, tokenize, typeDuration, typeSequence } from "./typeTokens";

describe("typewriter tokenizer", () => {
  it("keeps words and whitespace separate", () => {
    expect(tokenize("Every error, in 3D")).toEqual([
      { type: "word", chars: ["E", "v", "e", "r", "y"] },
      { type: "space", text: " " },
      { type: "word", chars: ["e", "r", "r", "o", "r", ","] },
      { type: "space", text: " " },
      { type: "word", chars: ["i", "n"] },
      { type: "space", text: " " },
      { type: "word", chars: ["3", "D"] },
    ]);
  });

  it("splits Armenian and Russian by letter", () => {
    expect(graphemes("Կառուցապատող")).toHaveLength(12);
    expect(graphemes("Отставание")).toHaveLength(10);
  });

  it("never splits a grapheme cluster", () => {
    expect(graphemes("é")).toEqual(["é"]); // e + combining acute
    expect(graphemes("🇦🇲")).toHaveLength(1);
  });

  it("caps long titles to the max duration", () => {
    expect(stepFor(10)).toBe(34);
    expect(stepFor(150, 34, 1500)).toBe(10);
    expect(stepFor(60, 34, 1500)).toBe(25);
  });
});

describe("textOf", () => {
  it("flattens strings, numbers, arrays and nested elements", () => {
    const node = ["Three ", createElement("span", { className: "x" }, "pil", createElement("em", null, "lars")), " ", 3];
    expect(textOf(node)).toBe("Three pillars 3");
  });

  it("reads <br> as a space and skips null/boolean", () => {
    expect(textOf(["Built", createElement("br"), "on time?", null, false, true])).toBe("Built on time?");
  });

  it("returns an empty string for nothing", () => {
    expect(textOf(undefined)).toBe("");
    expect(textOf(createElement("br"))).toBe(" ");
  });
});

describe("typeDuration", () => {
  it("counts visible letters only", () => {
    expect(letterCount("Every error, in 3D")).toBe(15);
    expect(letterCount(["Built", createElement("br"), "On Time?"])).toBe(12);
    expect(letterCount("   ")).toBe(0);
  });

  it("is letters x step, and honours the cap", () => {
    expect(typeDuration("Built")).toBe(5 * 34);
    expect(typeDuration("Built", 20)).toBe(100);
    expect(typeDuration("x".repeat(100), 34, 1500)).toBe(1500);
    expect(typeDuration("")).toBe(0);
  });

  it("chains split pieces without gaps or overlaps", () => {
    const { step, delays, total } = typeSequence(["Built", "On", "Time?"]);
    expect(step).toBe(34);
    expect(delays).toEqual([0, 170, 238]);
    expect(total).toBe(12 * 34);
  });

  it("fits a long split headline into maxDuration (hero budget)", () => {
    // Armenian hero: 10 + 1 + 10 letters, capped at 700 ms.
    const { step, delays, total } = typeSequence(["Կառուցվում", "է", "ժամանակի՞ն"], { maxDuration: 700 });
    expect(step).toBeCloseTo(700 / 21);
    expect(total).toBeLessThanOrEqual(700);
    expect(delays[1]).toBe(Math.round(10 * step));
    expect(delays[2]).toBe(Math.round(11 * step));
  });

  it("offsets the whole sequence by a start delay", () => {
    expect(typeSequence(["ab", "cd"], { delay: 100 }).delays).toEqual([100, 168]);
  });
});
