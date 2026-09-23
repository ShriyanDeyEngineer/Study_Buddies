/**
 * The tutorial video's URL handling (lib/tutorial.ts).
 *
 * This is the bit that has to be forgiving: whoever configures the video
 * will paste whatever YouTube gave them — the watch URL, the Share
 * shortlink, or an embed snippet — and all three should work. Anything
 * unrecognisable must return null so the feature hides rather than
 * rendering a broken frame.
 */
import { describe, expect, it } from "vitest";
import { youTubeEmbedUrl } from "@/lib/tutorial";

describe("youTubeEmbedUrl", () => {
  it("accepts the ordinary watch URL", () => {
    expect(youTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
  });

  it("accepts the youtu.be share link", () => {
    expect(youTubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
  });

  it("accepts an embed URL that's already in embed form", () => {
    expect(youTubeEmbedUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
  });

  it("keeps extra query junk out of the embed", () => {
    // Share links routinely carry ?t= and tracking params.
    expect(youTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
  });

  it("returns null when nothing is configured", () => {
    expect(youTubeEmbedUrl("")).toBeNull();
    expect(youTubeEmbedUrl("   ")).toBeNull();
  });

  it("returns null for non-YouTube and malformed links", () => {
    expect(youTubeEmbedUrl("https://drive.google.com/file/d/abc/view")).toBeNull();
    expect(youTubeEmbedUrl("https://vimeo.com/12345")).toBeNull();
    expect(youTubeEmbedUrl("not a url at all")).toBeNull();
    expect(youTubeEmbedUrl("https://www.youtube.com/")).toBeNull();
  });

  it("refuses a video id that isn't one, rather than building a bad embed", () => {
    expect(youTubeEmbedUrl("https://www.youtube.com/watch?v=../../evil")).toBeNull();
    expect(youTubeEmbedUrl("https://youtu.be/short")).toBeNull();
  });
});
