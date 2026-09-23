/**
 * Turning whatever YouTube link someone pasted into an embeddable one.
 *
 * Pure, and in lib/ rather than beside the component, for the same
 * reason as lib/meetup-email.ts and lib/groups/join-state.ts: the rules
 * are worth unit-testing and the tests shouldn't have to mount React.
 */

/**
 * Accepts watch?v=, youtu.be/ and /embed/ forms; returns null for
 * anything unrecognisable so the tutorial hides itself rather than
 * rendering a broken frame.
 *
 * youtube-nocookie.com is the no-tracking-cookie host — the right
 * default when embedding a third party into a student's session.
 */
export function youTubeEmbedUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let id: string | null = null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.endsWith("youtu.be")) {
      id = parsed.pathname.slice(1) || null;
    } else if (parsed.hostname.endsWith("youtube.com")) {
      id =
        parsed.searchParams.get("v") ??
        (parsed.pathname.startsWith("/embed/") ? parsed.pathname.slice(7) : null);
    }
  } catch {
    return null;
  }

  // YouTube ids are 11 chars of [A-Za-z0-9_-]; the range is loosened
  // slightly for safety rather than exactness. The point of the test is
  // to reject path traversal and empty ids, not to validate YouTube.
  if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
}
