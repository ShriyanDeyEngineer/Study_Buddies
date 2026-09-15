/**
 * Submitting a form without React 19's automatic reset.
 *
 * THE PROBLEM: when a function is passed to <form action={…}>, React resets
 * the form as soon as the action finishes — every uncontrolled input goes
 * back to its defaultValue and checkboxes clear. It does that even when the
 * server action came back with validation errors, so a student sees the
 * error message and finds everything they typed wiped.
 *
 * THE FIX: submit through onSubmit instead. React only resets forms whose
 * action prop ran, so running the same action ourselves, inside a
 * transition, keeps every input as typed. useActionState's pending flag and
 * a server action's redirect() behave exactly as before.
 *
 *   const [state, formAction, pending] = useActionState(saveThing, {});
 *   <form onSubmit={submitWithoutReset(formAction)} noValidate>
 *
 * To adjust the data first, or stop on a client-side check, pass a function
 * that ends by calling the action:
 *
 *   <form onSubmit={submitWithoutReset((formData) => {
 *     formData.set("scheduled_at", toUtc(formData.get("scheduled_at_local")));
 *     formAction(formData);
 *   })}>
 */
import { startTransition, type FormEvent } from "react";

export function submitWithoutReset(run: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Passing the submitter keeps the clicked button's name/value in the
    // data, the same as a native submission.
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => run(formData));
  };
}
