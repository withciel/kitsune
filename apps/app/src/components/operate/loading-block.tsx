import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Shared page-level loading skeleton. */
export function OperateLoadingBlock({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2 px-6 py-4', className)}>
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          key={index}
          className={index === 0 ? 'h-10 w-full' : 'h-10 w-full'}
        />
      ))}
    </div>
  );
}
