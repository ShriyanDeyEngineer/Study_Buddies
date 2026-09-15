import { describe, expect, it } from "vitest";
import { MAJOR_OTHER, MAJORS, majorChoiceFor, majorFromForm } from "@/lib/majors";
import { profileSchema } from "@/lib/validation/profile";

describe("MAJORS list", () => {
  it("has no duplicates (ignoring case), no Other entry, and fits the column", () => {
    const lower = MAJORS.map((major) => major.toLowerCase());
    expect(new Set(lower).size).toBe(MAJORS.length);
    expect(lower).not.toContain("other");
    expect(MAJORS.every((major) => major.length <= 100)).toBe(true);
  });

  it("lists Undecided first, then majors alphabetically", () => {
    expect(MAJORS[0]).toBe("Undecided");
    const rest = MAJORS.slice(1);
    expect([...rest].sort((a, b) => a.localeCompare(b, "en"))).toEqual(rest);
  });
});

describe("majorChoiceFor (prefilling the dropdown)", () => {
  it("selects nothing when there's no saved major", () => {
    expect(majorChoiceFor(null)).toEqual({ choice: "", other: "" });
    expect(majorChoiceFor("   ")).toEqual({ choice: "", other: "" });
  });

  it("selects the list entry for a saved major, ignoring case and spacing", () => {
    expect(majorChoiceFor("Computer Science")).toEqual({ choice: "Computer Science", other: "" });
    expect(majorChoiceFor("  computer science ")).toEqual({ choice: "Computer Science", other: "" });
  });

  it("opens Other with the text filled in for a major that isn't listed", () => {
    expect(majorChoiceFor("Pre-Med")).toEqual({ choice: MAJOR_OTHER, other: "Pre-Med" });
  });
});

describe("majorFromForm (what gets saved)", () => {
  it("saves a picked major and ignores the Other box", () => {
    expect(majorFromForm("Mathematics", "leftover text")).toBe("Mathematics");
  });

  it("saves the typed major when Other is picked", () => {
    expect(majorFromForm(MAJOR_OTHER, "  Pre-Med ")).toBe("Pre-Med");
  });

  it("uses the list's spelling when a typed or posted major is on the list", () => {
    expect(majorFromForm(MAJOR_OTHER, "computer science")).toBe("Computer Science");
    expect(majorFromForm("mathematics", null)).toBe("Mathematics");
  });

  it("means no major for Prefer not to say", () => {
    expect(majorFromForm("", "")).toBe("");
    expect(majorFromForm(null, null)).toBe("");
  });

  it("rejects Other with nothing typed instead of saving no major", () => {
    expect(majorFromForm(MAJOR_OTHER, "   ")).toBeUndefined();
    const result = profileSchema.safeParse({
      first_name: "Rand",
      last_name: "Name",
      college: null,
      major: majorFromForm(MAJOR_OTHER, ""),
      class_standing: null,
      graduation_month: null,
      graduation_year: null,
      bio: null,
      social_links: [],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.major).toEqual([
      "Type your major, or pick one from the list.",
    ]);
  });
});
