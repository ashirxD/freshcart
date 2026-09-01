import { FileQuestion } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ButtonLink } from '@/components/ui/button-link';

/** A mistyped admin URL, answered with a way back rather than a blank page. */
export default function AdminNotFound() {
  return (
    <div className="px-page py-lg mx-auto w-full max-w-md">
      <EmptyState
        icon={<FileQuestion className="size-7" aria-hidden="true" />}
        title="This admin page does not exist"
        description="The link may be out of date, or the page may have been renamed."
        action={<ButtonLink href="/admin">Back to the dashboard</ButtonLink>}
        className="bg-surface-muted rounded-lg"
      />
    </div>
  );
}
