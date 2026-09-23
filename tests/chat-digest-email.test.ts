/**
 * The batched group-chat digest email (lib/chat-digest-email.ts).
 *
 * The rules that matter here are editorial: one email covering every
 * group, a subject that names the group when there's only one, previews
 * that stay short, and nothing at all when there's nothing to say.
 */
import { describe, expect, it } from "vitest";
import { buildChatDigestEmail, truncate, type ChatDigestInput } from "@/lib/chat-digest-email";

const BASE: ChatDigestInput = {
  recipientName: "Riley",
  siteUrl: "https://example.com",
  groups: [
    {
      groupId: "g1",
      groupName: "Algo Grinders",
      unreadCount: 3,
      previews: [
        { author: "Jane Doe", body: "did anyone finish problem 4?" },
        { author: "John Smith", body: "I got 42 but I'm not sure" },
      ],
    },
  ],
};

describe("buildChatDigestEmail", () => {
  it("names the group in the subject when there is only one", () => {
    const email = buildChatDigestEmail(BASE)!;
    expect(email.subject).toContain("Algo Grinders");
    expect(email.subject).toContain("3 new messages");
  });

  it("summarises across groups when there is more than one", () => {
    const email = buildChatDigestEmail({
      ...BASE,
      groups: [
        ...BASE.groups,
        { groupId: "g2", groupName: "Calc Crew", unreadCount: 2, previews: [] },
      ],
    })!;
    expect(email.subject).toContain("5 new messages");
    expect(email.subject).toContain("2 groups");
    // One email, both groups in it — the whole point of batching.
    expect(email.text).toContain("Algo Grinders");
    expect(email.text).toContain("Calc Crew");
  });

  it("includes a link to each group", () => {
    const email = buildChatDigestEmail(BASE)!;
    expect(email.text).toContain("https://example.com/groups/g1");
    expect(email.html).toContain("https://example.com/groups/g1");
  });

  it("greets the recipient and falls back when the name is missing", () => {
    expect(buildChatDigestEmail(BASE)!.text).toContain("Hi Riley,");
    expect(
      buildChatDigestEmail({ ...BASE, recipientName: null })!.text,
    ).toContain("Hi there,");
  });

  it("sends nothing when there is nothing unread", () => {
    expect(buildChatDigestEmail({ ...BASE, groups: [] })).toBeNull();
    expect(
      buildChatDigestEmail({
        ...BASE,
        groups: [{ groupId: "g1", groupName: "Quiet", unreadCount: 0, previews: [] }],
      }),
    ).toBeNull();
  });

  it("escapes user-written text in the HTML part", () => {
    const email = buildChatDigestEmail({
      ...BASE,
      groups: [
        {
          groupId: "g1",
          groupName: "Tom & Jerry's <script>",
          unreadCount: 1,
          previews: [{ author: "Jane", body: "<img src=x onerror=alert(1)>" }],
        },
      ],
    })!;
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&amp;");
  });

  it("always carries both an HTML and a plain-text part", () => {
    const email = buildChatDigestEmail(BASE)!;
    expect(email.html).toContain("<!doctype html>");
    expect(email.text.length).toBeGreaterThan(0);
    expect(email.text).not.toContain("<td");
  });
});

describe("truncate", () => {
  it("leaves short messages alone", () => {
    expect(truncate("short one")).toBe("short one");
  });

  it("collapses whitespace so newlines don't break the layout", () => {
    expect(truncate("two\n\nlines   here")).toBe("two lines here");
  });

  it("cuts long messages on a word boundary and marks the cut", () => {
    const long = "word ".repeat(60);
    const result = truncate(long);
    expect(result.length).toBeLessThanOrEqual(141);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toContain("wor…");
  });
});
