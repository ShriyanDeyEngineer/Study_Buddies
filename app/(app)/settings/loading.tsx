/** Loading state for the settings pages (profile and courses, which
 *  inherit this boundary). Both are forms, so it's field-shaped. */
import { FormSkeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return <FormSkeleton fields={5} />;
}
