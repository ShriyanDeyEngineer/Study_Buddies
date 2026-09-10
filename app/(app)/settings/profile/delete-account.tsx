/**
 * The danger zone on /settings/profile: self-service account deletion
 * behind a type-to-confirm dialog (same pattern as disbanding a group).
 * The action signs the user out and redirects to the home page, so on
 * success this component never re-renders.
 */
"use client";

import { toast } from "sonner";
import { deleteAccountAction } from "@/lib/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TypedConfirmDialog } from "@/components/ui/confirm-dialog";

export function DeleteAccountCard() {
  return (
    <Card className="border-danger/40">
      <CardContent>
        <h2 className="font-display text-lg text-ink">Delete account</h2>
        <p className="mt-1 text-base text-ink-muted font-['Times_New_Roman']">
          This removes your profile, takes you out of your groups and
          everyone&rsquo;s friend lists, and cancels your pending requests.
          Messages you sent stay in their chats, shown as
          &ldquo;Deleted User&rdquo;. Deleted data cannot be recovered, signing
          in again starts a brand-new, empty account.
        </p>
        <div className="mt-4 font-['Times_New_Roman']">
          <TypedConfirmDialog
            title="Delete your account?"
            description="Your profile is removed, you leave every group, and you disappear from friend lists. Old messages remain, attributed to Deleted User. Deleted data cannot be recovered; signing in again starts a brand-new account."
            requiredText="DELETE"
            confirmLabel="Delete my account"
            onConfirm={async () => {
              // On success the action signs out and redirects to "/".
              const result = await deleteAccountAction();
              if (result?.error) toast.error(result.error);
            }}
          >
            <Button variant="danger">Delete Account…</Button>
          </TypedConfirmDialog>
        </div>
      </CardContent>
    </Card>
  );
}
