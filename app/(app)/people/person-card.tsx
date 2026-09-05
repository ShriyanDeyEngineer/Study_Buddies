/**
 * One person in the search results. Shows only what search_people()
 * returned — hidden fields arrive as null and simply don't render, so
 * this component can't leak anything even by accident.
 */
import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { PersonSearchResult } from "@/lib/types";
import { CLASS_STANDINGS, COLLEGES } from "@/lib/constants";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { pluralize } from "@/lib/utils";

export function PersonCard({ person }: { person: PersonSearchResult }) {
  const collegeLabel = COLLEGES.find((c) => c.value === person.college)?.label;
  const standingLabel = CLASS_STANDINGS.find(
    (s) => s.value === person.class_standing,
  )?.label;
  const detailLine = [standingLabel, person.major, collegeLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardContent className="flex items-start gap-3 p-4">
      <Avatar src={person.avatar_url} name={person.display_name} size="lg" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/profile/${person.id}`}
            className="font-medium text-ink hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {person.display_name}
          </Link>
          {detailLine && (
            <p className="mt-0.5 truncate text-sm text-ink-muted">{detailLine}</p>
          )}
          {person.graduation_year && (
            <p className="text-xs text-ink-muted">Class of {person.graduation_year}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {person.shared_courses > 0 && (
              <Badge variant="accent">
                {pluralize(person.shared_courses, "shared class", "shared classes")}
              </Badge>
            )}
            {person.is_available_for_buddies && (
              <Badge variant="success">
                <Sparkles aria-hidden className="h-3 w-3" />
                Open to study buddy
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
