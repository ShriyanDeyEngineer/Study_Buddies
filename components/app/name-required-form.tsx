/**
 * The form inside <NameRequiredScreen> (account-screens.tsx). A client
 * component only so field errors can render inline via useActionState.
 */
"use client";

import { useActionState } from "react";
import { saveNameAction } from "@/lib/actions/profile";
import { submitWithoutReset } from "@/lib/forms";
import type { NameParts } from "@/lib/names";
import { NameFields } from "@/components/app/name-fields";
import { Button } from "@/components/ui/button";

export function NameRequiredForm({ defaults }: { defaults: NameParts }) {
  const [state, formAction, pending] = useActionState(saveNameAction, {});

  return (
    <form onSubmit={submitWithoutReset(formAction)} noValidate className="mt-6 space-y-4 text-left">
      <NameFields defaults={defaults} fieldErrors={state.fieldErrors} />
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" loading={pending} className="w-full">
        Save and continue
      </Button>
    </form>
  );
}
