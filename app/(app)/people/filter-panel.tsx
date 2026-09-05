/**
 * The shared filter panel (spec §5.10): search box, multi-select
 * popovers (course / major / college / standing), grad-year range, the
 * study-buddy toggle, removable chips, and Clear all.
 *
 * Every change writes the URL (router.push) and the server re-renders
 * the results — the URL is the single source of truth, which is what
 * makes filtered views bookmarkable and shareable. This component never
 * filters anything itself.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, X } from "lucide-react";
import {
  filtersToSearchParams,
  hasActiveFilters,
  type PeopleFilters,
} from "@/lib/people/filters";
import {
  CLASS_STANDINGS,
  COLLEGES,
  GRAD_YEAR_MAX,
  GRAD_YEAR_MIN,
  SEARCH_MAX_LENGTH,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface CourseOption {
  id: string;
  label: string;
  short: string;
}

export function FilterPanel({
  filters,
  courseOptions,
  majorOptions,
}: {
  filters: PeopleFilters;
  courseOptions: CourseOption[];
  majorOptions: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState(filters.query ?? "");

  /** Push a modified copy of the current filters into the URL. */
  function apply(patch: Partial<PeopleFilters>) {
    const next = { ...filters, ...patch, page: 1 };
    const params = filtersToSearchParams(next);
    router.push(`/people${params.size ? `?${params.toString()}` : ""}`);
  }

  function toggleValue(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  /* Chips: one per active filter value, click to remove (spec §5.10). */
  const chips: { label: string; onRemove: () => void }[] = [
    ...filters.courseIds.map((id) => ({
      label: courseOptions.find((c) => c.id === id)?.short ?? "Course",
      onRemove: () => apply({ courseIds: filters.courseIds.filter((c) => c !== id) }),
    })),
    ...filters.majors.map((major) => ({
      label: major,
      onRemove: () => apply({ majors: filters.majors.filter((m) => m !== major) }),
    })),
    ...filters.colleges.map((college) => ({
      label: COLLEGES.find((c) => c.value === college)?.label ?? college,
      onRemove: () => apply({ colleges: filters.colleges.filter((c) => c !== college) }),
    })),
    ...filters.standings.map((standing) => ({
      label: CLASS_STANDINGS.find((s) => s.value === standing)?.label ?? standing,
      onRemove: () => apply({ standings: filters.standings.filter((s) => s !== standing) }),
    })),
    ...(filters.gradMin !== null
      ? [{ label: `From ${filters.gradMin}`, onRemove: () => apply({ gradMin: null }) }]
      : []),
    ...(filters.gradMax !== null
      ? [{ label: `To ${filters.gradMax}`, onRemove: () => apply({ gradMax: null }) }]
      : []),
    ...(filters.buddiesOnly
      ? [{ label: "Study buddies only", onRemove: () => apply({ buddiesOnly: false }) }]
      : []),
  ];

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      {/* Search — submits on Enter via the form. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ query: query.trim().length >= 2 ? query.trim() : null });
        }}
        className="relative"
      >
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Search by name (at least 2 characters)…"
          aria-label="Search people"
          className="pl-9"
        />
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <MultiSelectPopover
          label="Course"
          selectedCount={filters.courseIds.length}
          options={courseOptions.map((c) => ({ value: c.id, label: c.label }))}
          selected={filters.courseIds}
          onToggle={(value) => apply({ courseIds: toggleValue(filters.courseIds, value) })}
          searchable
        />
        <MultiSelectPopover
          label="Major"
          selectedCount={filters.majors.length}
          options={majorOptions.map((m) => ({ value: m, label: m }))}
          selected={filters.majors}
          onToggle={(value) => apply({ majors: toggleValue(filters.majors, value) })}
          searchable
          emptyNote="No majors on profiles yet."
        />
        <MultiSelectPopover
          label="College"
          selectedCount={filters.colleges.length}
          options={COLLEGES.map((c) => ({ value: c.value, label: c.label }))}
          selected={filters.colleges}
          onToggle={(value) => apply({ colleges: toggleValue(filters.colleges, value) })}
        />
        <MultiSelectPopover
          label="Class standing"
          selectedCount={filters.standings.length}
          options={CLASS_STANDINGS.map((s) => ({ value: s.value, label: s.label }))}
          selected={filters.standings}
          onToggle={(value) => apply({ standings: toggleValue(filters.standings, value) })}
        />

        {/* Graduation-year range. */}
        <div className="flex items-center gap-1.5">
          <YearSelect
            ariaLabel="Graduating no earlier than"
            value={filters.gradMin}
            placeholder="Grad from"
            onChange={(year) => apply({ gradMin: year })}
          />
          <span className="text-xs text-ink-muted">–</span>
          <YearSelect
            ariaLabel="Graduating no later than"
            value={filters.gradMax}
            placeholder="Grad to"
            onChange={(year) => apply({ gradMax: year })}
          />
        </div>

        {/* The study-buddy discovery toggle. */}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-ink">
          <Switch
            checked={filters.buddiesOnly}
            onCheckedChange={(checked) => apply({ buddiesOnly: checked === true })}
            aria-label="Only show students open to study buddies"
          />
          Study buddies only
        </label>
      </div>

      {(chips.length > 0 || filters.query) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {filters.query && (
            <Chip
              label={`"${filters.query}"`}
              onRemove={() => {
                setQuery("");
                apply({ query: null });
              }}
            />
          )}
          {chips.map((chip) => (
            <Chip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
          ))}
          {(hasActiveFilters(filters) || filters.query) && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                router.push("/people");
              }}
              className="text-sm font-medium text-primary underline underline-offset-2"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-light py-1 pl-3 pr-1.5 text-xs font-medium text-primary">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="rounded-full p-2 hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
      >
        <X aria-hidden className="h-3 w-3" />
      </button>
    </span>
  );
}

function MultiSelectPopover({
  label,
  selectedCount,
  options,
  selected,
  onToggle,
  searchable = false,
  emptyNote = "Nothing to pick yet.",
}: {
  label: string;
  selectedCount: number;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  searchable?: boolean;
  emptyNote?: string;
}) {
  const [search, setSearch] = React.useState("");
  const visible = options.filter((option) =>
    option.label.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn(selectedCount > 0 && "border-primary")}>
          {label}
          {selectedCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] text-white">
              {selectedCount}
            </span>
          )}
          <ChevronDown aria-hidden className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-80 overflow-y-auto">
        {searchable && options.length > 6 && (
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Filter ${label.toLowerCase()}s…`}
            aria-label={`Filter ${label} options`}
            className="mb-2 h-8"
          />
        )}
        {visible.length === 0 ? (
          <p className="px-1 py-2 text-sm text-ink-muted">{emptyNote}</p>
        ) : (
          <ul className="space-y-0.5">
            {visible.map((option) => (
              <li key={option.value}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm hover:bg-cream">
                  <Checkbox
                    checked={selected.includes(option.value)}
                    onCheckedChange={() => onToggle(option.value)}
                  />
                  <span className="min-w-0 flex-1 truncate text-ink">{option.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function YearSelect({
  value,
  placeholder,
  onChange,
  ariaLabel,
}: {
  value: number | null;
  placeholder: string;
  onChange: (year: number | null) => void;
  ariaLabel: string;
}) {
  return (
    <Select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      aria-label={ariaLabel}
      className="h-8 w-28 text-xs"
    >
      <option value="">{placeholder}</option>
      {Array.from({ length: GRAD_YEAR_MAX - GRAD_YEAR_MIN + 1 }, (_, i) => GRAD_YEAR_MIN + i).map(
        (year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ),
      )}
    </Select>
  );
}
