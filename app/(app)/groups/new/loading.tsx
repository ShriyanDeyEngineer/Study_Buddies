/** Loading state for the create-a-group form. */
import { FormSkeleton } from "@/components/ui/skeleton";

export default function NewGroupLoading() {
  return <FormSkeleton fields={4} />;
}
