/**
 * The When2Meet-style availability grid — the voting surface for a poll.
 *
 * WHAT YOU SEE: days across the top, half-hour times down the side. Each
 * cell is one 30-minute slot. Cells are shaded by how many members said
 * they're free then (a heat map — darker = more people), and the cells
 * YOU marked get a primary outline. Hover any cell to see who's free.
 *
 * HOW YOU VOTE: press on a cell and drag — every cell in the rectangle
 * you sweep gets painted. The first cell decides the mode: start on an
 * unmarked cell and you're ADDING availability, start on a marked cell
 * and you're REMOVING it (exactly When2Meet's rule, so a stray drag over
 * mixed cells does one predictable thing). Release to commit: your whole
 * selection for the poll is sent in ONE request (setAvailabilityVotesAction),
 * optimistically painted first, rolled back with a toast if the server
 * says no.
 *
 * TOUCH: works on phones — pointer events unify mouse and finger, and
 * `touch-action: none` on the grid stops the page from scrolling under
 * your drag. KEYBOARD: every cell is a real button; Space toggles one
 * cell, arrows are the browser's normal focus movement between them.
 *
 * WHY ONE COMPONENT, ONE SUBSCRIPTION: rendered once per poll. Live
 * updates from other members arrive through the parent's useLiveRefresh
 * (polls-section.tsx), not here — keeps this component pure-ish.
 */
"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { setAvailabilityVotesAction } from "@/lib/actions/meetups";
import {
  buildGrid,
  formatMinuteOfDay,
  slotsInRectangle,
  type Slot,
} from "@/lib/availability-grid";
import { cn, pluralize } from "@/lib/utils";

interface Vote {
  slot_id: string;
  user_id: string;
}

interface Member {
  id: string;
  display_name: string | null;
}

export function AvailabilityGrid({
  pollId,
  groupId,
  slots,
  votes,
  currentUserId,
  members,
  /** Called after a successful commit so the parent can refresh counts. */
  onCommitted,
  disabled = false,
}: {
  pollId: string;
  groupId: string;
  slots: Slot[];
  votes: Vote[];
  currentUserId: string;
  members: Member[];
  onCommitted?: () => void;
  disabled?: boolean;
}) {
  const grid = React.useMemo(() => buildGrid(slots), [slots]);
  const memberName = React.useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m.display_name ?? "Someone"])),
    [members],
  );

  // ── My selection (optimistic) ─────────────────────────────────────────
  const serverMine = React.useMemo(
    () => new Set(votes.filter((v) => v.user_id === currentUserId).map((v) => v.slot_id)),
    [votes, currentUserId],
  );
  const [mine, setMine] = React.useState<Set<string>>(serverMine);
  React.useEffect(() => setMine(serverMine), [serverMine]);

  // Everyone else's votes per slot (mine layered on top from `mine`, so
  // the heat map reflects my un-committed drag instantly).
  const othersBySlot = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const v of votes) {
      if (v.user_id === currentUserId) continue;
      (map.get(v.slot_id) ?? map.set(v.slot_id, []).get(v.slot_id)!).push(v.user_id);
    }
    return map;
  }, [votes, currentUserId]);

  const totalVoters = React.useMemo(() => {
    const ids = new Set(votes.map((v) => v.user_id));
    if (mine.size > 0) ids.add(currentUserId);
    return Math.max(ids.size, 1);
  }, [votes, mine, currentUserId]);

  // ── Drag state ────────────────────────────────────────────────────────
  const dragRef = React.useRef<{
    anchor: { dayIndex: number; rowIndex: number };
    mode: "add" | "remove";
    base: Set<string>;
  } | null>(null);
  const [preview, setPreview] = React.useState<Set<string> | null>(null);
  // THE BUG THIS REF FIXES: a quick click is pointerdown → pointerup inside
  // ONE frame. applyRect() calls setPreview(), but React state is async, so
  // when onPointerUp ran it still saw the OLD `preview` (null), concluded
  // "nothing changed", and returned without saving. Fast drags did the same
  // for the last cell. So the in-progress selection is ALSO kept here, in a
  // ref, which updates synchronously — onPointerUp reads this, never the
  // state. (State still drives the paint; the ref drives the commit.)
  const previewRef = React.useRef<Set<string> | null>(null);
  const [busy, setBusy] = React.useState(false);
  // Hovered cell + where to anchor its who's-free popup. Coordinates are
  // relative to wrapRef (the outermost, NON-scrolling box) — anchoring
  // inside the overflow-x-auto container would clip the popup at its edge.
  const [hover, setHover] = React.useState<{ id: string; x: number; y: number } | null>(
    null,
  );

  const shown = preview ?? mine;

  // Phone vs. laptop, for the responsive column width below. Matches
  // Tailwind's `md` breakpoint so it agrees with the rest of the layout.
  const [isNarrow, setIsNarrow] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  function cellAt(target: EventTarget | null) {
    const el = (target as HTMLElement | null)?.closest?.("[data-day][data-row]") as
      | HTMLElement
      | null;
    if (!el) return null;
    return { dayIndex: Number(el.dataset.day), rowIndex: Number(el.dataset.row) };
  }

  function applyRect(to: { dayIndex: number; rowIndex: number }) {
    const drag = dragRef.current;
    if (!drag) return;
    const ids = slotsInRectangle(grid, drag.anchor, to);
    const next = new Set(drag.base);
    for (const id of ids) drag.mode === "add" ? next.add(id) : next.delete(id);
    previewRef.current = next; // sync — what pointerup will commit
    setPreview(next); // async — what the screen paints
  }

  function onPointerDown(e: React.PointerEvent) {
    if (disabled || busy) return;
    const at = cellAt(e.target);
    if (!at) return;
    const id = grid.cell[grid.columns[at.dayIndex]?.dayKey]?.[grid.rows[at.rowIndex]?.minuteOfDay];
    if (!id) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { anchor: at, mode: mine.has(id) ? "remove" : "add", base: new Set(mine) };
    applyRect(at);
  }

  // Geometric hit-test: which (day, row) is under a screen point? We
  // measure the grid's real cells instead of asking document.elementFromPoint,
  // because that returns whatever's on TOP at that point — nothing when the
  // pointer drags outside the viewport, a sticky header when it crosses one.
  // The grid is uniform, so column/row math from the first cell's box is
  // exact and works even for cells scrolled off-screen (auto-scroll then
  // reveals them).
  const gridRef = React.useRef<HTMLDivElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  /** Track which cell the mouse is over and anchor the popup to it.
   *  One listener on the grid root (pointerover bubbles) instead of a
   *  handler per cell; anything that isn't a votable cell clears it. */
  function onPointerOver(e: React.PointerEvent) {
    const el = (e.target as HTMLElement | null)?.closest?.(
      "[data-day][data-row]",
    ) as HTMLElement | null;
    const wrap = wrapRef.current;
    if (!el || !wrap) {
      setHover(null);
      return;
    }
    const dayKey = grid.columns[Number(el.dataset.day)]?.dayKey;
    const minute = grid.rows[Number(el.dataset.row)]?.minuteOfDay;
    const id = dayKey !== undefined && minute !== undefined ? grid.cell[dayKey]?.[minute] : undefined;
    if (!id) {
      setHover(null);
      return;
    }
    const cellBox = el.getBoundingClientRect();
    const wrapBox = wrap.getBoundingClientRect();
    // Centered over the cell, clamped so it can't poke past the sides.
    const x = Math.min(
      Math.max(cellBox.left - wrapBox.left + cellBox.width / 2, 48),
      wrapBox.width - 48,
    );
    setHover({ id, x, y: cellBox.top - wrapBox.top });
  }

  function cellFromPoint(clientX: number, clientY: number) {
    const root = gridRef.current;
    if (!root) return null;
    const first = root.querySelector<HTMLElement>("[data-day='0'][data-row='0'], [data-day][data-row]");
    if (!first) return null;
    const fb = first.getBoundingClientRect();
    const day0 = Number(first.dataset.day);
    const row0 = Number(first.dataset.row);
    // Column width / row height from that cell; origin = where (day0,row0) sits.
    const colW = fb.width;
    const rowH = fb.height;
    if (!colW || !rowH) return null;
    const dayIndex = day0 + Math.floor((clientX - fb.left) / colW);
    const rowIndex = row0 + Math.floor((clientY - fb.top) / rowH);
    if (dayIndex < 0 || dayIndex >= grid.columns.length) return null;
    if (rowIndex < 0 || rowIndex >= grid.rows.length) return null;
    return { dayIndex, rowIndex };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const at = cellFromPoint(e.clientX, e.clientY);
    if (at) applyRect(at);
  }

  async function onPointerUp(e: React.PointerEvent) {
    // Touch has no hover state — don't leave a stale popup after the
    // finger lifts.
    if (e.pointerType !== "mouse") setHover(null);
    if (!dragRef.current) return;
    dragRef.current = null;
    // Read the ref, not `preview` state — see the comment on previewRef.
    const next = previewRef.current ?? mine;
    previewRef.current = null;
    setPreview(null);
    if (setsEqual(next, mine)) return;
    await commit(next);
  }

  async function commit(next: Set<string>) {
    const previous = mine;
    setMine(next); // optimistic
    setBusy(true);
    const { error } = await setAvailabilityVotesAction(pollId, groupId, [...next]);
    setBusy(false);
    if (error) {
      setMine(previous);
      toast.error(error);
      return;
    }
    onCommitted?.();
  }

  // Keyboard: Space/Enter toggles a single cell.
  function onCellKey(e: React.KeyboardEvent, id: string) {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (disabled || busy) return;
    const next = new Set(mine);
    next.has(id) ? next.delete(id) : next.add(id);
    void commit(next);
  }

  if (grid.columns.length === 0) {
    return <p className="text-sm text-ink-muted">This poll has no upcoming times.</p>;
  }

  // SIZING — the "not congested" rules, per the team's feedback:
  //   - Columns STRETCH to fill the available width (minmax(MIN, 1fr)), so a
  //     3-day poll gets three wide columns instead of three skinny ones
  //     with dead space to the right.
  //   - MIN column width is responsive. On a laptop the full-width row is
  //     ~1050 px, so 120 px/day fits 8 days with NO horizontal scroll (the
  //     ask was "at least 5"). On a phone the row is ~280 px, where 120 px
  //     would fit ONE day — so we drop to 72 px there: 3 days visible, a
  //     5-day poll is one short swipe. Past that the grid scrolls sideways;
  //     the page itself never does.
  //   - Rows are 36 px, not 24: tall enough that a fingertip lands on the
  //     half-hour it meant to.
  const TIME_COL = isNarrow ? 52 : 72; // px, the "9:00 AM" gutter
  const MIN_COL = isNarrow ? 64 : 120; // px, per day
  const ROW_H = "h-9"; // 36 px per half-hour
  const template = `${TIME_COL}px repeat(${grid.columns.length}, minmax(${MIN_COL}px, 1fr))`;

  // Legend steps for the heat map.
  const shade = (count: number) => {
    if (count === 0) return "bg-surface";
    const ratio = count / totalVoters;
    if (ratio >= 0.99) return "bg-success/70";
    if (ratio >= 0.66) return "bg-success/45";
    if (ratio >= 0.33) return "bg-success/25";
    return "bg-success/12";
  };

  const hoverInfo = hover
    ? (() => {
        const others = othersBySlot.get(hover.id) ?? [];
        const names = others.map((id) => memberName[id] ?? "Someone");
        if (shown.has(hover.id)) names.unshift("You");
        return names;
      })()
    : null;

  return (
    <div ref={wrapRef} className="relative space-y-2">
      <p className="text-xs text-ink-muted">
        Drag across the times you&rsquo;re free. Darker green = more people can make it.
      </p>

      <div className="overflow-x-auto rounded-xl border border-line">
        <div
          ref={gridRef}
          role="grid"
          aria-label="Availability grid — drag to mark when you're free"
          className="select-none touch-none"
          style={{ minWidth: `${TIME_COL + grid.columns.length * MIN_COL}px` }}
          onPointerOver={onPointerOver}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHover(null)}
        >
          {/* header row */}
          <div
            role="row"
            className="grid border-b border-line bg-cream/60"
            style={{ gridTemplateColumns: template }}
          >
            <div aria-hidden className="h-12" />
            {grid.columns.map((col) => (
              <div
                key={col.dayKey}
                role="columnheader"
                className="flex h-12 flex-col items-center justify-center text-xs leading-tight text-ink"
              >
                <span className="font-medium">{format(col.date, "EEE")}</span>
                <span className="text-ink-muted">{format(col.date, "MMM d")}</span>
              </div>
            ))}
          </div>

          {/* time rows */}
          {grid.rows.map((row, rowIndex) => {
            const isHour = row.minuteOfDay % 60 === 0;
            return (
              <div
                key={row.minuteOfDay}
                role="row"
                className="grid"
                style={{ gridTemplateColumns: template }}
              >
                <div
                  role="rowheader"
                  className={cn(
                    "flex items-start justify-end pr-2 text-[11px] text-ink-muted",
                    ROW_H,
                    // Label sits at the top edge of its hour row (like a
                    // calendar); half-hour rows are unlabeled to reduce noise.
                    "-translate-y-2",
                    !isHour && "text-transparent",
                  )}
                >
                  {formatMinuteOfDay(row.minuteOfDay)}
                </div>
                {grid.columns.map((col, dayIndex) => {
                  const id = grid.cell[col.dayKey]?.[row.minuteOfDay];
                  if (!id) {
                    return (
                      <div
                        key={col.dayKey}
                        role="gridcell"
                        aria-disabled="true"
                        className={cn(ROW_H, "border-b border-l border-line/60 bg-line/30")}
                      />
                    );
                  }
                  const others = othersBySlot.get(id)?.length ?? 0;
                  const isMine = shown.has(id);
                  const count = others + (isMine ? 1 : 0);
                  return (
                    <button
                      key={col.dayKey}
                      type="button"
                      role="gridcell"
                      data-day={dayIndex}
                      data-row={rowIndex}
                      aria-pressed={isMine}
                      aria-label={`${format(col.date, "EEE M/d")} ${formatMinuteOfDay(row.minuteOfDay)} — ${pluralize(count, "person", "people")} free${isMine ? ", including you" : ""}`}
                      disabled={disabled}
                      onKeyDown={(e) => onCellKey(e, id)}
                      className={cn(
                        ROW_H,
                        "border-b border-l border-line/60 transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                        isHour ? "border-b-line" : "border-b-line/40",
                        shade(count),
                        isMine && "shadow-[inset_0_0_0_2px_var(--color-primary)]",
                        disabled ? "cursor-default" : "cursor-pointer",
                      )}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Who's-free popup: floats just above the hovered cell and
          disappears the moment the mouse leaves it. margin:0 inline
          keeps the parent's space-y from nudging the anchor point. */}
      {hover && hoverInfo && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 max-w-72 -translate-x-1/2 -translate-y-full truncate whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink shadow-md"
          style={{ left: hover.x, top: hover.y - 6, margin: 0 }}
        >
          {hoverInfo.length
            ? `Free: ${hoverInfo.join(", ")}`
            : "Nobody's free at this time yet"}
        </div>
      )}

      {/* Saving state + legend */}
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-ink" aria-live="polite">
          {busy ? "Saving…" : `${pluralize(mine.size, "slot")} marked`}
        </span>
        <span className="flex items-center gap-1 text-ink-muted">
          <span className="text-[10px]">fewer</span>
          {["bg-success/12", "bg-success/25", "bg-success/45", "bg-success/70"].map((c) => (
            <span key={c} className={cn("inline-block h-3 w-4 rounded-sm border border-line", c)} />
          ))}
          <span className="text-[10px]">everyone</span>
        </span>
      </div>
    </div>
  );
}

function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
