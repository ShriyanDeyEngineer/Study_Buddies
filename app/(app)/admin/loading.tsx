/**
 * Loading state for every /admin page (the segment's own page plus
 * groups, people, requests, flags and messages, which inherit this
 * boundary because they don't define their own).
 *
 * The admin pages are the heaviest reads in the app — a few hundred rows
 * each, unfiltered — so they are the ones most likely to sit blank while
 * they load. Rows rather than cards: every admin view is a list.
 */
import { ListSkeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return <ListSkeleton rows={10} />;
}
