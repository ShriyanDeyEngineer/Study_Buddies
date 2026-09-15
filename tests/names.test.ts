import { describe, expect, it } from "vitest";
import { suggestNameParts } from "@/lib/names";

describe("suggestNameParts", () => {
  it("prefers Google's given_name and family_name", () => {
    expect(
      suggestNameParts({ given_name: "Alex", family_name: "Rivera", full_name: "Lex R" }),
    ).toEqual({ first_name: "Alex", last_name: "Rivera" });
  });

  it("splits full_name at the first space, keeping compound surnames whole", () => {
    expect(suggestNameParts({ full_name: "Ana García López" })).toEqual({
      first_name: "Ana",
      last_name: "García López",
    });
  });

  it("falls back to name when full_name is missing", () => {
    expect(suggestNameParts({ name: "  Sam   Lee " })).toEqual({
      first_name: "Sam",
      last_name: "Lee",
    });
  });

  it("leaves the last name blank for a single-word name", () => {
    expect(suggestNameParts({ full_name: "Prince" })).toEqual({
      first_name: "Prince",
      last_name: "",
    });
  });

  it("returns blanks for missing or non-string metadata", () => {
    const blank = { first_name: "", last_name: "" };
    expect(suggestNameParts(undefined)).toEqual(blank);
    expect(suggestNameParts({})).toEqual(blank);
    expect(suggestNameParts({ full_name: 42 })).toEqual(blank);
  });

  it("caps each part at 50 characters", () => {
    const long = "x".repeat(60);
    const parts = suggestNameParts({ given_name: long, family_name: long });
    expect(parts.first_name).toHaveLength(50);
    expect(parts.last_name).toHaveLength(50);
  });
});
