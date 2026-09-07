/**
 * Testimonials (/testimonials).
 *
 * We don't have real quotes yet, and the spec (and basic honesty) forbids
 * inventing them — so this page IS its own empty state: an invitation to
 * be among the first users. When real quotes arrive, add them to the
 * TESTIMONIALS array and the empty state disappears automatically.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Testimonials",
  description: "What UMN students say about Study Buddies.",
};

/** Real quotes only — never marketing-invented ones. Each needs the
 *  student's permission before it ships. */
const TESTIMONIALS: { quote: string; attribution: string }[] = [
  //{ quote: "quote 1", attribution: "attributor 1"},
  //{ quote: "quote 2", attribution: "attributor 2"},
];

export default function TestimonialsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl text-ink">Testimonials</h1>
        <p className="mt-4 text-ink-muted">What students say about Study Buddies.</p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl">
        {TESTIMONIALS.length === 0 ? (
          <EmptyState
            title="No testimonials yet"
            description="We just launched. If the site helps you, email us and we may feature your words here."
            action={
              <Button asChild variant="secondary">
                <Link href={`mailto:${CONTACT_EMAIL}`}>Be the First</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-6">
            {TESTIMONIALS.map((t) => (
              <Card key={t.attribution}>
                <CardContent>
                  <blockquote className="text-ink">&ldquo;{t.quote}&rdquo;</blockquote>
                  <p className="mt-3 text-sm text-ink-muted">— {t.attribution}</p>
                </CardContent>
              </Card>
            ))}
            <Button asChild variant="secondary">
              <Link href={`mailto:${CONTACT_EMAIL}`}>Submit a Testimonial</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
