import { Skeleton } from '@/components/ui/skeleton';

/** Shown while an admin route's data resolves, so navigation never blanks. */
export default function AdminLoading() {
  return (
    <div className="gap-gutter px-page py-loose mx-auto flex w-full max-w-[1400px] flex-col">
      <Skeleton className="h-8 w-56" label="Loading" />
      <div className="gap-gutter grid grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
