/**
 * The walkthrough video: a dialog, plus the two ways to reach it.
 *
 *   1. "Watch the tutorial" in the account menu — always there, for
 *      anyone who wants a refresher.
 *   2. Automatically, once, for an account that has never seen it
 *      (profiles.tutorial_seen_at, migration 0044).
 *
 * One dialog serves both, so the provider owns the open state and the
 * menu item reaches it through context.
 *
 * IF NO VIDEO IS CONFIGURED the whole feature disappears — no menu item,
 * no prompt. See TUTORIAL_VIDEO_URL in lib/constants.ts. That keeps a
 * half-finished feature invisible rather than broken.
 */
"use client";

import * as React from "react";
import { markTutorialSeenAction } from "@/lib/actions/profile";
import { TUTORIAL_VIDEO_URL } from "@/lib/constants";
import { youTubeEmbedUrl } from "@/lib/tutorial";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface TutorialContextValue {
  /** null when no video is configured — callers hide their entry point. */
  open: (() => void) | null;
}

const TutorialContext = React.createContext<TutorialContextValue>({ open: null });

/** Lets any client component offer a way into the tutorial. */
export function useTutorial(): TutorialContextValue {
  return React.useContext(TutorialContext);
}

export function TutorialProvider({
  children,
  /** True when this account has never been shown the video. */
  showOnFirstVisit = false,
}: {
  children: React.ReactNode;
  showOnFirstVisit?: boolean;
}) {
  const embedUrl = youTubeEmbedUrl(TUTORIAL_VIDEO_URL);
  const [isOpen, setIsOpen] = React.useState(false);

  // The one-time prompt. Marking it seen happens as soon as it's shown,
  // not when it's closed or watched to the end: the promise is "we won't
  // interrupt you about this again", and someone who dismisses it
  // immediately has still been offered it.
  React.useEffect(() => {
    if (!embedUrl || !showOnFirstVisit) return;
    setIsOpen(true);
    void markTutorialSeenAction();
  }, [embedUrl, showOnFirstVisit]);

  const value = React.useMemo<TutorialContextValue>(
    () => ({ open: embedUrl ? () => setIsOpen(true) : null }),
    [embedUrl],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {embedUrl && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogTitle>How Study Buddies works</DialogTitle>
            <DialogDescription>
              A two-minute tour: find your courses, join or start a group, and
              set up your first study session. You can reopen this any time from
              the menu under your avatar.
            </DialogDescription>
            {/* 16:9 box so the frame keeps its shape at every width —
                aspect-ratio rather than a padding hack, and max-w-full so
                it can't push the dialog wider than the phone. */}
            <div className="mt-4 aspect-video w-full max-w-full overflow-hidden rounded-xl bg-ink">
              <iframe
                src={embedUrl}
                title="Study Buddies walkthrough"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </TutorialContext.Provider>
  );
}
