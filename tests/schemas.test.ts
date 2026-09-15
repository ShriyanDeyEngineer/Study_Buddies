/**
 * Form-schema boundary tests (spec §11 lists the exact boundaries to
 * hit: 2,000 vs 2,001 characters, capacity 2/50 vs 1/51, grad years at
 * the range edges, five vs six social links, and the meetup conditional
 * rules — those live in meetup.test.ts).
 */
import { describe, expect, it } from "vitest";
import { messageContentSchema } from "@/lib/validation/message";
import { createGroupSchema } from "@/lib/validation/group";
import { addCourseSchema, courseRequestSchema } from "@/lib/validation/course";
import { profileSchema } from "@/lib/validation/profile";
import { reportSchema } from "@/lib/validation/report";
import { flagSchema } from "@/lib/validation/flag";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

describe("message length (chat + DMs share the rule)", () => {
  it("2,000 characters passes; 2,001 fails", () => {
    expect(messageContentSchema.safeParse("x".repeat(2000)).success).toBe(true);
    expect(messageContentSchema.safeParse("x".repeat(2001)).success).toBe(false);
  });

  it("whitespace-only is empty, not content", () => {
    expect(messageContentSchema.safeParse("   \n\t ").success).toBe(false);
    expect(messageContentSchema.safeParse("hi").success).toBe(true);
  });
});

describe("group creation", () => {
  function group(overrides: Record<string, unknown> = {}) {
    return createGroupSchema.safeParse({
      course_id: UUID,
      name: "Problem Set Crew",
      description: "",
      capacity: 8,
      mode: "open",
      invitee_ids: [],
      ...overrides,
    });
  }

  it("capacity 2 and 50 pass; 1 and 51 fail (spec boundaries)", () => {
    expect(group({ capacity: 2 }).success).toBe(true);
    expect(group({ capacity: 50 }).success).toBe(true);
    expect(group({ capacity: 1 }).success).toBe(false);
    expect(group({ capacity: 51 }).success).toBe(false);
  });

  it("capacity must be a whole number", () => {
    expect(group({ capacity: 7.5 }).success).toBe(false);
  });

  it("name boundaries: 1 and 100 pass; empty and 101 fail", () => {
    expect(group({ name: "A" }).success).toBe(true);
    expect(group({ name: "x".repeat(100) }).success).toBe(true);
    expect(group({ name: "" }).success).toBe(false);
    expect(group({ name: "x".repeat(101) }).success).toBe(false);
  });

  it("description is optional; 2000 passes, 2001 fails", () => {
    expect(group({ description: "" }).success).toBe(true);
    expect(group({ description: "x".repeat(2000) }).success).toBe(true);
    expect(group({ description: "x".repeat(2001) }).success).toBe(false);
  });

  it("caps invitations at capacity − 1 (creator takes a seat)", () => {
    const twoInvitees = [UUID, UUID.replace("1", "2")];
    expect(group({ capacity: 3, invitee_ids: twoInvitees }).success).toBe(true);
    expect(group({ capacity: 2, invitee_ids: twoInvitees }).success).toBe(false);
  });

  it("rejects unknown modes and bad course ids", () => {
    expect(group({ mode: "secret" }).success).toBe(false);
    expect(group({ course_id: "not-a-uuid" }).success).toBe(false);
  });
});

describe("add-a-course", () => {
  it("normalizes codes to uppercase", () => {
    const result = addCourseSchema.safeParse({
      department_code: "csci",
      course_number: "1301w",
      course_name: "Intro",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.department_code).toBe("CSCI");
    expect(result.data.course_number).toBe("1301W");
  });

  it.each([
    ["1-letter department", { department_code: "C" }],
    ["digits in department", { department_code: "CS1" }],
    ["letters-first number", { course_number: "W1301" }],
    ["empty name", { course_name: "" }],
  ])("rejects %s", (_name, override) => {
    const result = addCourseSchema.safeParse({
      department_code: "CSCI",
      course_number: "1133",
      course_name: "Intro",
      ...override,
    });
    expect(result.success).toBe(false);
  });
});

describe("course request (student-filed — name is optional here)", () => {
  it("accepts an empty course name", () => {
    const result = courseRequestSchema.safeParse({
      department_code: "csci",
      course_number: "1133",
      course_name: "",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.course_name).toBe("");
  });

  it.each([
    ["1-letter department", { department_code: "C" }],
    ["digits in department", { department_code: "CS1" }],
    ["letters-first number", { course_number: "W1301" }],
    ["name over 200 characters", { course_name: "x".repeat(201) }],
  ])("still rejects %s", (_name, override) => {
    const result = courseRequestSchema.safeParse({
      department_code: "CSCI",
      course_number: "1133",
      course_name: "",
      ...override,
    });
    expect(result.success).toBe(false);
  });
});

describe("profile", () => {
  function profile(overrides: Record<string, unknown> = {}) {
    return profileSchema.safeParse({
      first_name: "Rand",
      last_name: "Name",
      college: null,
      major: null,
      class_standing: null,
      graduation_month: null,
      graduation_year: null,
      bio: null,
      social_links: [],
      ...overrides,
    });
  }

  it("first and last name: 1 and 50 pass; missing, blank and 51 fail", () => {
    for (const field of ["first_name", "last_name"]) {
      expect(profile({ [field]: "G" }).success).toBe(true);
      expect(profile({ [field]: "x".repeat(50) }).success).toBe(true);
      expect(profile({ [field]: null }).success).toBe(false);
      expect(profile({ [field]: "  " }).success).toBe(false);
      expect(profile({ [field]: "x".repeat(51) }).success).toBe(false);
    }
  });

  it("real names that trip the profanity filter are accepted", () => {
    expect(profile({ first_name: "Dick", last_name: "Shitole" }).success).toBe(true);
  });

  it("bio boundaries: 500 passes, 501 fails", () => {
    expect(profile({ bio: "x".repeat(500) }).success).toBe(true);
    expect(profile({ bio: "x".repeat(501) }).success).toBe(false);
  });

  it("grad years at the range edges pass; outside fails", () => {
    expect(profile({ graduation_year: 2020 }).success).toBe(true);
    expect(profile({ graduation_year: 2040 }).success).toBe(true);
    expect(profile({ graduation_year: 2019 }).success).toBe(false);
    expect(profile({ graduation_year: 2041 }).success).toBe(false);
  });

  it("five social links pass; six fail; non-http(s) fails", () => {
    const link = "https://example.com/";
    expect(profile({ social_links: Array(5).fill(link) }).success).toBe(true);
    expect(profile({ social_links: Array(6).fill(link) }).success).toBe(false);
    expect(profile({ social_links: ["ftp://example.com"] }).success).toBe(false);
    expect(profile({ social_links: ["javascript:alert(1)"] }).success).toBe(false);
    expect(profile({ social_links: ["not a url"] }).success).toBe(false);
  });

  it('empty strings normalize to null ("prefer not to say")', () => {
    const result = profile({ college: "", major: "", graduation_year: "" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.college).toBeNull();
    expect(result.data.major).toBeNull();
    expect(result.data.graduation_year).toBeNull();
  });
});

describe("reports", () => {
  it("requires a category from the fixed list", () => {
    expect(
      reportSchema.safeParse({ reported_user_id: UUID, category: "harassment" }).success,
    ).toBe(true);
    expect(
      reportSchema.safeParse({ reported_user_id: UUID, category: "vibes" }).success,
    ).toBe(false);
  });

  it("description boundaries: 1,000 passes, 1,001 fails", () => {
    expect(
      reportSchema.safeParse({
        reported_user_id: UUID,
        category: "spam",
        description: "x".repeat(1000),
      }).success,
    ).toBe(true);
    expect(
      reportSchema.safeParse({
        reported_user_id: UUID,
        category: "spam",
        description: "x".repeat(1001),
      }).success,
    ).toBe(false);
  });
});

describe("content flags", () => {
  it("accepts each valid content type; rejects anything else", () => {
    for (const t of ["group_message", "direct_message", "group_resource"]) {
      expect(flagSchema.safeParse({ content_type: t, content_id: UUID }).success).toBe(true);
    }
    expect(
      flagSchema.safeParse({ content_type: "profile", content_id: UUID }).success,
    ).toBe(false);
  });

  it("requires a UUID content id", () => {
    expect(
      flagSchema.safeParse({ content_type: "group_message", content_id: "nope" }).success,
    ).toBe(false);
  });

  it("reason is optional; 1,000 passes, 1,001 fails", () => {
    const base = { content_type: "direct_message", content_id: UUID };
    expect(flagSchema.safeParse(base).success).toBe(true);
    expect(flagSchema.safeParse({ ...base, reason: "x".repeat(1000) }).success).toBe(true);
    expect(flagSchema.safeParse({ ...base, reason: "x".repeat(1001) }).success).toBe(false);
  });
});
