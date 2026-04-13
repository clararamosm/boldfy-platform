// src/components/calendar/calendar-skeleton.tsx
// Shared calendar loading skeleton used by all calendario pages.

import { Skeleton } from '@/components/ui/skeleton';

type CalendarSkeletonProps = {
  /** Height class for day cells. Defaults to "h-24". */
  cellHeight?: string;
  /** Whether to show a second skeleton in the header (e.g. filter button). */
  showHeaderAction?: boolean;
};

export function CalendarSkeleton({
  cellHeight = 'h-24',
  showHeaderAction = true,
}: CalendarSkeletonProps = {}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        {showHeaderAction && <Skeleton className="h-10 w-32" />}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-8" />
        ))}
        {[...Array(35)].map((_, i) => (
          <Skeleton key={`d-${i}`} className={cellHeight} />
        ))}
      </div>
    </div>
  );
}
