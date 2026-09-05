/**
 * Resources (group page): shared notes and links for the group. Members
 * add either; the author or the manager can delete. No file uploads on
 * purpose — links to Docs/Drive cover that without eating our storage.
 */
"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ExternalLink, FilePlus2, Link2, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addResourceAction, deleteResourceAction } from "@/lib/actions/resources";
import {
  RESOURCE_NOTE_MAX,
  RESOURCE_TITLE_MAX,
} from "@/lib/validation/resource";
import type { GroupResourceRow, PublicProfile } from "@/lib/types";
import { FlagControl } from "@/components/moderation/flag-control";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function ResourcesPanel({
  groupId,
  currentUserId,
  isManager,
  resources,
  profiles,
  flaggedResourceIds = [],
}: {
  groupId: string;
  currentUserId: string;
  isManager: boolean;
  resources: GroupResourceRow[];
  profiles: Record<string, PublicProfile>;
  /** Resource ids the current viewer has already flagged (0040). */
  flaggedResourceIds?: string[];
}) {
  const router = useRouter();
  const flaggedIds = React.useMemo(
    () => new Set(flaggedResourceIds),
    [flaggedResourceIds],
  );
  // Deleted rows disappear immediately instead of after a full group-page
  // re-render; restored if the server rejects the delete.
  const [removedIds, setRemovedIds] = React.useState<string[]>([]);
  React.useEffect(() => setRemovedIds([]), [resources]);
  const visible = resources.filter((r) => !removedIds.includes(r.id));

  async function remove(resourceId: string) {
    setRemovedIds((ids) => [...ids, resourceId]);
    const { error } = await deleteResourceAction(resourceId, groupId);
    if (error) {
      setRemovedIds((ids) => ids.filter((id) => id !== resourceId));
      toast.error(error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">Resources</h2>
        <AddResourceDialog groupId={groupId} />
      </div>

      {visible.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">
          Share notes and links here — study guides, formula sheets, a link to
          the group&rsquo;s Google Doc.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((resource) => {
            const author = profiles[resource.author_id];
            const canDelete = resource.author_id === currentUserId || isManager;
            const canFlag = resource.author_id !== currentUserId;
            const Icon = resource.kind === "link" ? Link2 : StickyNote;
            return (
              <li
                key={resource.id}
                className="rounded-xl border border-line p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium text-ink">
                      <Icon aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 break-words">{resource.title}</span>
                    </p>
                    {resource.kind === "link" ? (
                      <a
                        href={resource.content}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="mt-1 inline-flex max-w-full items-center gap-1 text-sm text-primary underline underline-offset-2"
                      >
                        <span className="truncate">{resource.content}</span>
                        <ExternalLink aria-hidden className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">
                        {resource.content}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-ink-muted">
                      {author?.display_name ?? "Deleted User"} ·{" "}
                      {format(new Date(resource.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {canFlag && (
                      <FlagControl
                        variant="icon"
                        contentType="group_resource"
                        contentId={resource.id}
                        flagged={flaggedIds.has(resource.id)}
                        label="this resource"
                      />
                    )}
                    {canDelete && (
                      <ConfirmDialog
                        title="Delete this resource?"
                        description="It disappears for the whole group. There is no undo."
                        confirmLabel="Delete"
                        onConfirm={() => remove(resource.id)}
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete resource: ${resource.title}`}
                          className="shrink-0 text-ink-muted hover:text-danger"
                        >
                          <Trash2 aria-hidden className="h-4 w-4" />
                        </Button>
                      </ConfirmDialog>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddResourceDialog({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(addResourceAction, {});
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<"note" | "link">("note");
  const router = useRouter();
  const noteButtonRef = React.useRef<HTMLButtonElement>(null);
  const linkButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (state.success && open) {
      toast.success(state.success);
      setOpen(false);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacting to action completion
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FilePlus2 aria-hidden className="h-4 w-4" />
          Add resource
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Add a resource</DialogTitle>
        <DialogDescription>
          Share a note or a link with the group. No file uploads — link to a
          Google Doc or Drive folder instead.
        </DialogDescription>

        <form action={formAction} noValidate className="mt-4 space-y-4">
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="kind" value={kind} />

          {/* note / link switch */}
          <div
            className="grid grid-cols-2 gap-2"
            role="radiogroup"
            aria-label="Resource type"
            onKeyDown={(e) => {
              // Standard radiogroup arrow-key behavior: move the
              // selection, don't just move focus (Tab/Enter already
              // worked without this — this is the roving-tabindex part).
              if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
              e.preventDefault();
              const next = kind === "note" ? "link" : "note";
              setKind(next);
              (next === "note" ? noteButtonRef : linkButtonRef).current?.focus();
            }}
          >
            {(["note", "link"] as const).map((value) => (
              <button
                key={value}
                ref={value === "note" ? noteButtonRef : linkButtonRef}
                type="button"
                role="radio"
                aria-checked={kind === value}
                tabIndex={kind === value ? 0 : -1}
                onClick={() => setKind(value)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium",
                  kind === value
                    ? "border-primary bg-primary text-white"
                    : "border-line bg-surface text-ink-muted hover:text-ink",
                )}
              >
                {value === "note" ? (
                  <StickyNote aria-hidden className="h-4 w-4" />
                ) : (
                  <Link2 aria-hidden className="h-4 w-4" />
                )}
                {value === "note" ? "Note" : "Link"}
              </button>
            ))}
          </div>

          <div>
            <Label htmlFor="resource-title">Title (required)</Label>
            <Input
              id="resource-title"
              name="title"
              maxLength={RESOURCE_TITLE_MAX}
              placeholder={kind === "note" ? "Week 6 recursion cheat sheet" : "Shared study doc"}
              required
              aria-invalid={!!state.fieldErrors?.title}
              aria-describedby="resource-title-error"
            />
            <FieldError id="resource-title-error" error={state.fieldErrors?.title} />
          </div>

          <div>
            <Label htmlFor="resource-content">
              {kind === "note" ? "Note" : "Link"} (required)
            </Label>
            {kind === "note" ? (
              <Textarea
                id="resource-content"
                name="content"
                rows={6}
                maxLength={RESOURCE_NOTE_MAX}
                placeholder="Paste or write the note…"
                required
                aria-invalid={!!state.fieldErrors?.content}
                aria-describedby="resource-content-error"
              />
            ) : (
              <Input
                id="resource-content"
                name="content"
                type="url"
                inputMode="url"
                placeholder="https://docs.google.com/…"
                required
                aria-invalid={!!state.fieldErrors?.content}
                aria-describedby="resource-content-error"
              />
            )}
            <FieldError id="resource-content-error" error={state.fieldErrors?.content} />
          </div>

          {state.error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={pending}>
            Add it
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
